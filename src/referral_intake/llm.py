"""Provider-neutral structured-output adapters."""

import json
import os

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from pydantic import BaseModel

from referral_intake.clinical_requirements.models import (
    ReferenceSelection,
    RequirementDefinition,
    RequirementExtraction,
)
from referral_intake.extraction import EXTRACTION_INSTRUCTIONS, validate_extraction
from referral_intake.models import ReferralExtraction


def _structured_model(schema: type[BaseModel]):
    """Initialize the configured chat model with structured output."""

    load_dotenv()
    provider_name = _required_setting("LLM_PROVIDER")
    model_name = _required_setting("LLM_MODEL")

    llm = init_chat_model(
        model=model_name,
        model_provider=provider_name,
        api_key=_required_setting("OPENAI_API_KEY"),
        max_retries=2,
    )
    return llm.with_structured_output(schema, method="json_schema")


def _required_setting(name: str) -> str:
    """Read a required LLM setting from the environment."""

    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not configured in .env.")
    return value


class StructuredReferralExtractor:
    """Extract a validated referral object with structured output."""

    def extract(self, markdown: str) -> ReferralExtraction:
        structured_llm = _structured_model(ReferralExtraction)
        prompt = f"""{EXTRACTION_INSTRUCTIONS}

Referral Markdown:
<referral>
{markdown}
</referral>
"""
        result = structured_llm.invoke(prompt)
        if isinstance(result, ReferralExtraction):
            return result
        return validate_extraction(result)


class StructuredReferenceSelector:
    """Select supported logical references from loaded skill instructions."""

    def select(
        self,
        skill_instructions: str,
        condition: str | None,
        service: str | None,
        reason_for_referral: str | None,
    ) -> ReferenceSelection:
        structured_llm = _structured_model(ReferenceSelection)
        messages = [
            (
                "system",
                "Read the skill instructions. Select a supported condition "
                "reference and service reference only when each is clearly "
                "matched. Return null for an unsupported or ambiguous category. "
                "Return only logical IDs through the structured fields.\n\n"
                f"Skill instructions:\n{skill_instructions}",
            ),
            (
                "human",
                f"Condition: {condition or 'Not provided'}\n"
                f"Service: {service or 'Not provided'}\n"
                "Reason for referral: "
                f"{reason_for_referral or 'Not provided'}",
            ),
        ]
        result = structured_llm.invoke(messages)
        if isinstance(result, ReferenceSelection):
            return result
        return ReferenceSelection.model_validate(result)


class StructuredRequirementExtractor:
    """Extract values for a compiled set of clinical requirements."""

    def extract(
        self,
        markdown: str,
        requirements: list[RequirementDefinition],
    ) -> RequirementExtraction:
        structured_llm = _structured_model(RequirementExtraction)
        requirement_data = [
            requirement.model_dump(exclude={"source"}) for requirement in requirements
        ]
        messages = [
            (
                "system",
                "Extract only information explicitly documented in the referral. "
                "Return exactly one finding for every requirement ID. Use "
                "documented with a concise value when present; otherwise use "
                "not_documented with a null value. Do not infer clinical facts.",
            ),
            (
                "human",
                "Requirements:\n"
                f"{json.dumps(requirement_data, indent=2)}\n\n"
                "Referral Markdown:\n"
                f"<referral>\n{markdown}\n</referral>",
            ),
        ]
        result = structured_llm.invoke(messages)
        if isinstance(result, RequirementExtraction):
            return result
        return RequirementExtraction.model_validate(result)

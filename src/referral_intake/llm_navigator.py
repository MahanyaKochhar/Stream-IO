"""UF Navigator structured-output adapters."""

import json
import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from referral_intake.clinical_requirements.models import (
    ReferenceSelection,
    RequirementDefinition,
    RequirementExtraction,
)
from referral_intake.extraction import EXTRACTION_INSTRUCTIONS, validate_extraction
from referral_intake.models import ReferralExtraction

NAVIGATOR_API_BASE = "https://api.ai.it.ufl.edu"


def _structured_model(schema: type[BaseModel]):
    """Initialize UF Navigator with structured output."""

    load_dotenv()
    llm = ChatOpenAI(
        openai_api_base=NAVIGATOR_API_BASE,
        openai_api_key=_required_setting("NAVIGATOR_API_KEY"),
        model=_required_setting("NAVIGATOR_MODEL"),
        temperature=0.1,
        max_retries=2,
    )
    return llm.with_structured_output(schema, method="json_schema")


def _required_setting(name: str) -> str:
    """Read a required Navigator setting from the environment."""

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
                "Use each requirement's guidance as its extraction criteria; "
                "description is a short display label. "
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

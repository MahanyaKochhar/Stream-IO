"""Provider-neutral structured-output adapters."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from pydantic import BaseModel

from referral_intake.clinical_requirements.models import ReferenceSelection
from referral_intake.extraction import EXTRACTION_INSTRUCTIONS, validate_extraction
from referral_intake.models import ReferralExtraction

DEFAULT_LLM_PROVIDER = "google_genai"
DEFAULT_LLM_MODEL = "gemini-3.7-flash"


def _structured_model(
    schema: type[BaseModel],
    *,
    provider: str | None,
    model: str | None,
):
    """Initialize the configured chat model with structured output."""

    load_dotenv()
    provider_name = provider or os.getenv("LLM_PROVIDER") or DEFAULT_LLM_PROVIDER
    model_name = (
        model
        or os.getenv("LLM_MODEL")
        or os.getenv("GEMINI_MODEL")
        or DEFAULT_LLM_MODEL
    )
    model_options: dict[str, object] = {}
    if provider_name == "google_genai":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini credentials are missing. Set GEMINI_API_KEY.")
        model_options["api_key"] = api_key

    llm = init_chat_model(
        model=model_name,
        model_provider=provider_name,
        max_retries=2,
        **model_options,
    )
    return llm.with_structured_output(schema, method="json_schema")


@dataclass(frozen=True)
class StructuredReferralExtractor:
    """Extract a validated referral object with structured output."""

    provider: str | None = None
    model: str | None = None

    def extract(self, markdown: str) -> ReferralExtraction:
        structured_llm = _structured_model(
            ReferralExtraction,
            provider=self.provider,
            model=self.model,
        )
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


@dataclass(frozen=True)
class StructuredReferenceSelector:
    """Select supported logical references from loaded skill instructions."""

    provider: str | None = None
    model: str | None = None

    def select(
        self,
        *,
        skill_instructions: str,
        condition: str | None,
        service: str | None,
        reason_for_referral: str | None,
    ) -> ReferenceSelection:
        structured_llm = _structured_model(
            ReferenceSelection,
            provider=self.provider,
            model=self.model,
        )
        messages = [
            (
                "system",
                "Read the skill instructions and select exactly one supported "
                "condition reference and one supported service reference. "
                "Return only their logical IDs through the structured fields.\n\n"
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

"""Gemini structured-output adapter for referral extraction."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

from referral_intake.extraction import EXTRACTION_INSTRUCTIONS, validate_extraction
from referral_intake.models import ReferralExtraction

DEFAULT_GEMINI_MODEL = "gemini-3.7-flash"


@dataclass(frozen=True)
class GeminiReferralExtractor:
    """Extract a validated referral object with Gemini native JSON schema."""

    model: str | None = None

    def extract(self, markdown: str) -> ReferralExtraction:
        load_dotenv()
        if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
            raise RuntimeError(
                "Gemini credentials are missing. Set GEMINI_API_KEY or "
                "GOOGLE_API_KEY in .env."
            )

        model = self.model or os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        llm = ChatGoogleGenerativeAI(model=model, max_retries=2)
        structured_llm = llm.with_structured_output(
            ReferralExtraction,
            method="json_schema",
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

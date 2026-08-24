"""LangGraph state definitions."""

from typing import Literal, NotRequired, TypedDict

from referral_intake.clinical_requirements.models import ClinicalRequirementsResult
from referral_intake.models import Insurance, Patient, ReferralExtraction

Outcome = Literal[
    "processing",
    "needs_information",
    "human_review_required",
    "human_reviewed",
    "ready_for_next_stage",
    "referral_approved",
    "referral_rejected",
]


class ReferralState(TypedDict):
    """Shared workflow state.

    External service clients belong in LangGraph runtime context, not here.
    Extracted data remains nested under ``extracted`` until validation nodes
    promote accepted patient and insurance objects into top-level state fields.
    """

    pdf_path: str
    markdown: str
    extracted: ReferralExtraction
    patient: Patient
    insurance: Insurance
    clinical_requirements: ClinicalRequirementsResult
    missing_fields: NotRequired[list[str]]
    outcome: NotRequired[Outcome]
    message: NotRequired[str]
    review_text: NotRequired[str]

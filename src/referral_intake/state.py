"""LangGraph state definitions."""

from typing import Literal, NotRequired

from typing_extensions import TypedDict

from referral_intake.classification import DocumentClassification
from referral_intake.clinical_requirements.models import ClinicalRequirementsResult
from referral_intake.models import Insurance, Patient, ReferralExtraction

Outcome = Literal[
    "processing",
    "not_referral_document",
    "needs_information",
    "human_review_required",
    "human_reviewed",
    "ready_for_next_stage",
    "referral_approved",
    "referral_rejected",
]


class ReferralInput(TypedDict):
    """Public graph input accepted by Agent Server."""

    pdf_path: str
    pdf_name: NotRequired[str]


class ClinicalRequirementsInput(TypedDict):
    """Parent channels read by the clinical subgraph."""

    markdown: str
    extracted: ReferralExtraction


class ClinicalRequirementsOutput(TypedDict):
    """Clinical subgraph channels returned to the parent."""

    clinical_requirements: ClinicalRequirementsResult


class ReferralState(
    ReferralInput,
    ClinicalRequirementsInput,
    ClinicalRequirementsOutput,
):
    """Shared workflow state.

    External service clients belong in graph dependencies, not here.
    Extracted data remains nested under ``extracted`` until validation nodes
    promote accepted patient and insurance objects into top-level state fields.
    """

    outcome: NotRequired[Outcome]
    patient: Patient
    insurance: Insurance
    document_classification: NotRequired[DocumentClassification]
    missing_fields: NotRequired[list[str]]
    message: NotRequired[str]
    review_text: NotRequired[str]

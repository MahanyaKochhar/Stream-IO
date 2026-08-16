"""LangGraph state definitions."""

from typing import Literal, NotRequired, TypedDict

from referral_intake.models import Insurance, Patient, ReferralExtraction

Outcome = Literal[
    "processing",
    "needs_information",
    "rejected",
    "ready_for_next_stage",
]


class ReferralState(TypedDict):
    """Shared workflow state.

    External service clients belong in LangGraph runtime context, not here.
    Extracted data remains nested under ``extracted`` until validation nodes
    promote accepted patient and insurance objects into top-level state fields.
    """

    pdf_path: str
    markdown: NotRequired[str]
    extracted: NotRequired[ReferralExtraction]
    patient: NotRequired[Patient]
    insurance: NotRequired[Insurance]
    missing_fields: NotRequired[list[str]]
    outcome: NotRequired[Outcome]
    message: NotRequired[str]

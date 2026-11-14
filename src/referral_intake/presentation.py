"""Presentation contracts at the boundary of the business workflow."""

from collections.abc import Mapping, Sequence
from typing import Any, Literal

from langchain_core.messages import HumanMessage, ToolMessage
from pydantic import BaseModel, ConfigDict, Field

from referral_intake.public import public_referral

Component = Literal["referral_summary", "clinical_findings"]
Stage = Literal[
    "referral_packet", "intake_details", "clinical_review", "coordinator_review"
]


class CardRow(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: str = Field(min_length=1)
    value: str = Field(min_length=1)


class PresentationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    component: Component
    rows: list[CardRow] = Field(min_length=1)


def saved_referral(messages: Sequence) -> dict[str, Any]:
    """Read the latest saved referral, including older artifact formats."""
    for message in reversed(messages):
        if (
            isinstance(message, ToolMessage)
            and message.name == "referral_intake"
            and isinstance(message.artifact, dict)
            and message.artifact.get("pdf_path")
        ):
            return public_referral(message.artifact)
        if isinstance(message, HumanMessage):
            referral = message.additional_kwargs.get("referral")
            if isinstance(referral, dict) and referral.get("pdf_path"):
                return public_referral(referral)
    return {}


def progress(state: Mapping[str, Any]) -> dict[str, str]:
    """Project available business data into a compact milestone event."""
    outcome = state.get("outcome")
    stage: Stage
    status = "active"
    if outcome == "not_referral_document":
        stage, status = "referral_packet", "attention"
    elif outcome in {"human_review_required", "human_reviewed", "needs_information"}:
        stage, status = "intake_details", "attention"
    elif outcome in {"referral_approved", "referral_rejected"}:
        stage, status = "coordinator_review", "complete"
    elif state.get("clinical_requirements"):
        stage = "coordinator_review"
    elif state.get("insurance"):
        stage = "clinical_review"
    elif state.get("document_classification") or state.get("extracted"):
        stage = "intake_details"
    else:
        stage = "referral_packet"
    return {"type": "referral_progress", "stage": stage, "status": status}

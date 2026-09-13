"""Small helpers for trusted generative UI messages."""

from typing import Any

from langgraph.graph.ui import UIMessage

from referral_intake.clinical_requirements.models import (
    ReferralDecision,
    RequirementDefinition,
    RequirementFinding,
)


def ui_message(name: str, props: dict[str, Any], message_id: str) -> UIMessage:
    """Create a stable UI message for the frontend component registry."""

    return {
        "type": "ui",
        "id": message_id,
        "name": name,
        "props": props,
        "metadata": {},
    }


def completion_ui(outcome: str, message: str | None = None) -> UIMessage:
    """Build the assistant completion message for a terminal outcome."""

    copy = {
        "not_referral_document": (
            "Not a referral document",
            message or "Please upload a patient referral packet.",
        ),
        "referral_approved": (
            "Referral approved",
            "The referral packet was approved and intake is complete.",
        ),
        "referral_rejected": (
            "Referral rejected",
            "The referral packet was rejected during coordinator review.",
        ),
        "needs_information": (
            "Referral incomplete",
            message or "Required referral information is missing.",
        ),
        "human_reviewed": (
            "Routing review recorded",
            "The referral was not completed and requires routing follow-up.",
        ),
    }
    title, description = copy[outcome]
    return ui_message(
        "referral_completion",
        {"outcome": outcome, "title": title, "message": description},
        "referral-completion",
    )


def clinical_review_ui(
    requirements: list[RequirementDefinition],
    findings: list[RequirementFinding],
    *,
    editable: bool,
    decision: ReferralDecision | None = None,
) -> UIMessage:
    """Build the registered clinical-review component message."""

    return ui_message(
        "clinical_review",
        {
            "instruction": "Review and edit the clinical findings before deciding.",
            "findings": [finding.model_dump(mode="json") for finding in findings],
            "requirements": [
                requirement.model_dump(mode="json")
                for requirement in requirements
            ],
            "editable": editable,
            "decision": decision.value if decision else None,
        },
        "clinical-review",
    )

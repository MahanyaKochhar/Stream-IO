"""Small helpers for trusted generative UI messages."""

from typing import Any

from langgraph.graph.ui import UIMessage


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

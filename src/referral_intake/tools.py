"""Intake execution and read-only presentation tools for Stream."""

import json

from langchain.tools import ToolRuntime, tool

from referral_intake.dependencies import GraphDependencies
from referral_intake.graph import build_graph
from referral_intake.presentation import (
    CardRow,
    Component,
    PresentationInput,
    progress,
    saved_referral,
)
from referral_intake.public import public_referral


def build_referral_intake(dependencies: GraphDependencies):
    """Bind the deterministic intake graph to its services."""
    intake = build_graph(dependencies)

    @tool(response_format="content_and_artifact")
    def referral_intake(runtime: ToolRuntime) -> tuple[str, dict]:
        """Process the attached PDF, pausing for required human review."""
        referral = saved_referral(runtime.state["messages"])
        if not referral.get("pdf_path"):
            return "Ask the user to attach a referral PDF before starting intake.", {}

        previous = {}
        last_progress = None
        first = True
        for values in intake.stream(
            {key: referral[key] for key in ("pdf_path", "pdf_name") if key in referral},
            config=runtime.config,
            stream_mode="values",
        ):
            result = public_referral(values)
            patch = {
                key: value
                for key, value in result.items()
                if key not in previous or previous[key] != value
            }
            if first or patch:
                runtime.stream_writer(
                    {
                        "type": "referral_delta",
                        "patch": patch,
                        "reset": first,
                    }
                )
            current_progress = progress(result)
            if current_progress != last_progress:
                runtime.stream_writer(current_progress)
                last_progress = current_progress
            previous = result
            first = False

        # Structured data remains available to follow-up questions and the UI;
        # markdown and presentation state never enter the tool result.
        return json.dumps(previous, separators=(",", ":")), previous

    return referral_intake


@tool(
    args_schema=PresentationInput,
    response_format="content_and_artifact",
)
def present_referral(component: Component, rows: list[CardRow]) -> tuple[str, dict]:
    """Display selected facts from the saved referral as labeled rows in a card."""
    return "Card displayed.", {
        "type": "referral_presentation",
        "component": component,
        "rows": [row.model_dump() for row in rows],
    }

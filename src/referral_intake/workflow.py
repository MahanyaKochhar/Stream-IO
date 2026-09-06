"""Coordinator-facing workflow progress shared with the frontend."""

from typing import Annotated, Literal

from typing_extensions import TypedDict

from referral_intake.ui import ui_message

WorkflowStatus = Literal["active", "complete", "attention"]
WorkflowStage = Literal[
    "referral_packet",
    "intake_details",
    "clinical_review",
    "coordinator_review",
]


class CoordinatorWorkflowStep(TypedDict):
    """One user-facing milestone, independent of internal graph nodes."""

    id: WorkflowStage
    title: str
    description: str
    status: WorkflowStatus
    order: int


CoordinatorWorkflow = dict[WorkflowStage, CoordinatorWorkflowStep]


def merge_workflow(
    current: CoordinatorWorkflow,
    update: CoordinatorWorkflow,
) -> CoordinatorWorkflow:
    """Merge stage updates by stable ID while preserving prior milestones."""

    return current | update


WorkflowChannel = Annotated[CoordinatorWorkflow, merge_workflow]

_WORKFLOW_COPY: dict[WorkflowStage, tuple[int, str, str]] = {
    "referral_packet": (
        1,
        "Referral packet",
        "Reading and organizing the uploaded clinical document.",
    ),
    "intake_details": (
        2,
        "Intake details",
        "Checking patient, insurance, and referral information.",
    ),
    "clinical_review": (
        3,
        "Clinical review",
        "Preparing relevant clinical requirements and findings.",
    ),
    "coordinator_review": (
        4,
        "Coordinator review",
        "Waiting for review.",
    ),
}


def workflow_update(
    *updates: tuple[WorkflowStage, WorkflowStatus],
) -> CoordinatorWorkflow:
    """Build a state update containing only the supplied milestones."""

    workflow: CoordinatorWorkflow = {}
    for stage, status in updates:
        order, title, description = _WORKFLOW_COPY[stage]
        workflow[stage] = {
            "id": stage,
            "title": title,
            "description": description,
            "status": status,
            "order": order,
        }
    return workflow


def workflow_ui_update(
    current: CoordinatorWorkflow,
    *updates: tuple[WorkflowStage, WorkflowStatus],
) -> dict[str, object]:
    """Return durable workflow state and its generative UI projection."""

    patch = workflow_update(*updates)
    workflow = merge_workflow(current, patch)
    return {
        "workflow": patch,
        "ui": ui_message(
            "referral_progress",
            {"workflow": workflow},
            "referral-progress",
        ),
    }

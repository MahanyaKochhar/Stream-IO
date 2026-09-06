"""Nodes for the clinical-requirements subagent."""

from datetime import UTC, datetime
from typing import Literal

from langgraph.graph import END
from langgraph.types import Command, interrupt

from referral_intake.clinical_requirements.catalog import (
    compile_requirements as compile_skill_requirements,
)
from referral_intake.clinical_requirements.catalog import (
    load_references as load_reference_content,
)
from referral_intake.clinical_requirements.catalog import (
    load_skill_instructions,
)
from referral_intake.clinical_requirements.catalog import (
    select_skill as select_skill_from_catalog,
)
from referral_intake.clinical_requirements.models import (
    ClinicalRequirementsResult,
    ReferralDecision,
    ReferralReviewResponse,
    RequirementDefinition,
    RequirementFinding,
)
from referral_intake.clinical_requirements.state import ClinicalRequirementsState
from referral_intake.dependencies import GraphDependencies
from referral_intake.state import ReferralState
from referral_intake.ui import completion_ui, ui_message
from referral_intake.workflow import workflow_ui_update


def select_skill(
    state: ClinicalRequirementsState,
) -> Command[Literal["load_skill"]]:
    """Select a skill deterministically from specialty and subspecialty."""

    extracted = state["extracted"]
    skill_name = select_skill_from_catalog(
        extracted.specialty,
        extracted.subspecialty,
    )
    return Command(
        update={"selected_skill": skill_name},
        goto="load_skill",
    )


def load_skill(
    state: ClinicalRequirementsState,
) -> Command[Literal["select_references"]]:
    """Load the selected skill's complete SKILL.md instructions."""

    instructions = load_skill_instructions(state["selected_skill"])
    return Command(
        update={
            "skill_instructions": instructions,
        },
        goto="select_references",
    )


def select_references(
    state: ClinicalRequirementsState,
    dependencies: GraphDependencies,
) -> Command[Literal["load_references"]]:
    """Select supported condition and service reference IDs."""

    extracted = state["extracted"]
    selection = dependencies.reference_selector.select(
        skill_instructions=state["skill_instructions"],
        condition=extracted.condition,
        service=extracted.service,
        reason_for_referral=extracted.reason_for_referral,
    )
    return Command(
        update={"selected_references": selection},
        goto="load_references",
    )


def load_references(
    state: ClinicalRequirementsState,
) -> Command[Literal["compile_requirements"]]:
    """Load selected reference content under logical reference IDs."""

    contents = load_reference_content(
        state["selected_skill"], state["selected_references"]
    )
    return Command(
        update={"reference_contents": contents},
        goto="compile_requirements",
    )


def compile_requirements(
    state: ClinicalRequirementsState,
) -> Command[Literal["extract_requirement_values"]]:
    """Compile common and selected reference requirements deterministically."""

    requirements = compile_skill_requirements(
        state["skill_instructions"], state["reference_contents"]
    )
    return Command(
        update={"compiled_requirements": requirements},
        goto="extract_requirement_values",
    )


def extract_requirement_values(
    state: ClinicalRequirementsState,
    dependencies: GraphDependencies,
) -> Command[Literal[END]]:
    """Extract values for compiled requirements from referral Markdown."""

    extraction = dependencies.requirement_extractor.extract(
        markdown=state["markdown"],
        requirements=state["compiled_requirements"],
    )
    progress = workflow_ui_update(
        state["workflow"],
        ("clinical_review", "complete"),
        ("coordinator_review", "active"),
    )
    return Command(
        update={
            "extracted_findings": extraction.findings,
            "clinical_requirements": ClinicalRequirementsResult(
                skill=state["selected_skill"],
                references=state["selected_references"],
                requirements=state["compiled_requirements"],
                findings=extraction.findings,
            ),
            **progress,
            "ui": [
                progress["ui"],
                _clinical_review_ui(
                    state["compiled_requirements"],
                    extraction.findings,
                    editable=True,
                ),
            ],
        },
        goto=END,
    )


def review_referral_packet(
    state: ReferralState,
) -> Command[Literal[END]]:
    """Pause for a human to approve or reject the referral packet."""

    response = interrupt({"type": "clinical_review"})
    review = ReferralReviewResponse.model_validate(response)
    decision = review.decision
    clinical = state["clinical_requirements"]
    expected_ids = {requirement.id for requirement in clinical.requirements}
    finding_ids = [finding.requirement_id for finding in review.findings]
    if len(finding_ids) != len(expected_ids) or set(finding_ids) != expected_ids:
        raise ValueError("Reviewed findings must match the clinical requirements.")

    outcome = (
        "referral_approved"
        if decision is ReferralDecision.APPROVE
        else "referral_rejected"
    )
    progress = workflow_ui_update(
        state["workflow"],
        ("coordinator_review", "complete"),
    )
    return Command(
        update={
            "clinical_requirements": ClinicalRequirementsResult(
                skill=clinical.skill,
                references=clinical.references,
                requirements=clinical.requirements,
                findings=review.findings,
                decision=decision,
                reviewed_by=review.reviewed_by,
                reviewed_at=datetime.now(UTC).isoformat(),
            ),
            "outcome": outcome,
            **progress,
            "ui": [
                progress["ui"],
                _clinical_review_ui(
                    clinical.requirements,
                    review.findings,
                    editable=False,
                    decision=decision,
                ),
                completion_ui(outcome),
            ],
        },
        goto=END,
    )


def _clinical_review_ui(
    requirements: list[RequirementDefinition],
    findings: list[RequirementFinding],
    *,
    editable: bool,
    decision: ReferralDecision | None = None,
):
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

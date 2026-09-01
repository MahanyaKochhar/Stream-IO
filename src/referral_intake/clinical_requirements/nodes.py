"""Nodes for the clinical-requirements subagent."""

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
)
from referral_intake.clinical_requirements.state import ClinicalRequirementsState
from referral_intake.dependencies import GraphDependencies


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
) -> Command[Literal["review_referral_packet"]]:
    """Extract values for compiled requirements from referral Markdown."""

    extraction = dependencies.requirement_extractor.extract(
        markdown=state["markdown"],
        requirements=state["compiled_requirements"],
    )
    return Command(
        update={"extracted_findings": extraction.findings},
        goto="review_referral_packet",
    )


def review_referral_packet(
    state: ClinicalRequirementsState,
) -> Command[Literal[END]]:
    """Pause for a human to approve or reject the referral packet."""

    review_request = {
        "instruction": "Review the clinical findings and approve or reject "
        "the referral packet.",
        "options": [decision.value for decision in ReferralDecision],
        "findings": [
            finding.model_dump(mode="json")
            for finding in state["extracted_findings"]
        ],
        "requirements": [
            requirement.model_dump(mode="json")
            for requirement in state["compiled_requirements"]
        ],
    }
    response = interrupt(review_request)
    decision = ReferralDecision(str(response).strip().casefold())

    outcome = (
        "referral_approved"
        if decision is ReferralDecision.APPROVE
        else "referral_rejected"
    )
    return Command(
        update={
            "clinical_requirements": ClinicalRequirementsResult(
                skill=state["selected_skill"],
                references=state["selected_references"],
                requirements=state["compiled_requirements"],
                findings=state["extracted_findings"],
                decision=decision,
            ),
            "outcome": outcome,
        },
        goto=END,
    )

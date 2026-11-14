"""Nodes for the clinical-requirements subagent."""

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
)
from referral_intake.clinical_requirements.state import ClinicalRequirementsState
from referral_intake.dependencies import GraphDependencies


def select_skill(
    state: ClinicalRequirementsState,
) -> dict:
    """Select a skill deterministically from specialty and subspecialty."""

    extracted = state["extracted"]
    skill_name = select_skill_from_catalog(
        extracted.specialty,
        extracted.subspecialty,
    )
    return {"selected_skill": skill_name}


def load_skill(
    state: ClinicalRequirementsState,
) -> dict:
    """Load the selected skill's complete SKILL.md instructions."""

    instructions = load_skill_instructions(state["selected_skill"])
    return {"skill_instructions": instructions}


def select_references(
    state: ClinicalRequirementsState,
    dependencies: GraphDependencies,
) -> dict:
    """Select supported condition and service reference IDs."""

    extracted = state["extracted"]
    selection = dependencies.reference_selector.select(
        skill_instructions=state["skill_instructions"],
        condition=extracted.condition,
        service=extracted.service,
        reason_for_referral=extracted.reason_for_referral,
    )
    return {"selected_references": selection}


def load_references(
    state: ClinicalRequirementsState,
) -> dict:
    """Load selected reference content under logical reference IDs."""

    contents = load_reference_content(
        state["selected_skill"], state["selected_references"]
    )
    return {"reference_contents": contents}


def compile_requirements(
    state: ClinicalRequirementsState,
) -> dict:
    """Compile common and selected reference requirements deterministically."""

    requirements = compile_skill_requirements(
        state["skill_instructions"], state["reference_contents"]
    )
    return {"compiled_requirements": requirements}


def extract_requirement_values(
    state: ClinicalRequirementsState,
    dependencies: GraphDependencies,
) -> dict:
    """Extract values for compiled requirements from referral Markdown."""

    extraction = dependencies.requirement_extractor.extract(
        markdown=state["markdown"],
        requirements=state["compiled_requirements"],
    )
    return {
        "clinical_requirements": ClinicalRequirementsResult(
            skill=state["selected_skill"],
            references=state["selected_references"],
            requirements=state["compiled_requirements"],
            findings=extraction.findings,
        ),
    }

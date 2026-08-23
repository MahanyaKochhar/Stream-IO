"""Private additions to the parent state for the clinical subgraph."""

from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ReferenceSelection,
    RequirementDefinition,
)
from referral_intake.state import ReferralState


class ClinicalRequirementsState(ReferralState):
    """Parent state plus working fields private to the compiled subgraph."""

    selected_skill: ClinicalSkillName
    skill_instructions: str
    selected_references: ReferenceSelection
    reference_contents: dict[str, str]
    compiled_requirements: list[RequirementDefinition]

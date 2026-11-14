"""Clinical subgraph inputs, output, and private working fields."""

from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ReferenceSelection,
    RequirementDefinition,
)
from referral_intake.state import (
    ClinicalRequirementsInput,
    ClinicalRequirementsOutput,
)


class ClinicalRequirementsState(ClinicalRequirementsInput, ClinicalRequirementsOutput):
    """Clinical inputs and output plus private working fields."""

    selected_skill: ClinicalSkillName
    skill_instructions: str
    selected_references: ReferenceSelection
    reference_contents: dict[str, str]
    compiled_requirements: list[RequirementDefinition]

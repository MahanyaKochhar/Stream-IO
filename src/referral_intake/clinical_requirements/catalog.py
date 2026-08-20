"""Static catalog and deterministic file access for clinical skills."""

from dataclasses import dataclass
from pathlib import Path

from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ConditionReference,
    ReferenceSelection,
    ServiceReference,
)

SKILLS_ROOT = Path(__file__).resolve().parents[3] / "skills"


@dataclass(frozen=True)
class SkillDefinition:
    """Static mapping from a logical skill ID to its directory."""

    name: ClinicalSkillName
    directory: Path


SKILLS = (
    SkillDefinition(
        ClinicalSkillName.KNEE,
        Path("orthopedics/knee"),
    ),
)

SKILL_LOOKUP = {
    (specialty, "knee"): ClinicalSkillName.KNEE
    for specialty in (
        "orthopedic surgery",
        "orthopaedic surgery",
        "orthopedics",
        "orthopaedics",
    )
}

REFERENCE_FILES = {
    ConditionReference.OSTEOARTHRITIS: Path(
        "references/conditions/osteoarthritis.md"
    ),
    ConditionReference.ACL_TEAR: Path("references/conditions/acl-tear.md"),
    ConditionReference.MENISCUS_TEAR: Path(
        "references/conditions/meniscus-tear.md"
    ),
    ServiceReference.SURGICAL_EVALUATION: Path(
        "references/services/surgical-evaluation.md"
    ),
    ServiceReference.GENERAL_CONSULT: Path(
        "references/services/general-consult.md"
    ),
}


def select_skill(
    specialty: str | None,
    subspecialty: str | None,
) -> ClinicalSkillName:
    """Select a skill deterministically from specialty and subspecialty."""

    key = (_normalize(specialty), _normalize(subspecialty))
    try:
        return SKILL_LOOKUP[key]
    except KeyError as error:
        raise ValueError(
            "No clinical skill supports the extracted specialty and subspecialty."
        ) from error


def load_skill_instructions(skill_name: ClinicalSkillName) -> str:
    """Load the selected skill's complete SKILL.md instructions."""

    return _skill_directory(skill_name).joinpath("SKILL.md").read_text(
        encoding="utf-8"
    )


def load_references(
    skill_name: ClinicalSkillName,
    selection: ReferenceSelection,
) -> dict[str, str]:
    """Load selected references keyed only by their logical IDs."""

    skill_directory = _skill_directory(skill_name)
    references = (selection.condition, selection.service)
    return {
        reference.value: skill_directory.joinpath(
            REFERENCE_FILES[reference]
        ).read_text(encoding="utf-8")
        for reference in references
    }


def _skill_directory(skill_name: ClinicalSkillName) -> Path:
    definition = next(skill for skill in SKILLS if skill.name is skill_name)
    return SKILLS_ROOT / definition.directory


def _normalize(value: str | None) -> str:
    return value.strip().casefold() if value else ""

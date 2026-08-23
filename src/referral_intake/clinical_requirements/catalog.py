"""Static catalog and deterministic file access for clinical skills."""

from dataclasses import dataclass
from pathlib import Path

import yaml

from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ConditionReference,
    ReferenceSelection,
    RequirementDefinition,
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
    ConditionReference.OSTEOARTHRITIS: Path("references/conditions/osteoarthritis.md"),
    ConditionReference.ACL_TEAR: Path("references/conditions/acl-tear.md"),
    ConditionReference.MENISCUS_TEAR: Path("references/conditions/meniscus-tear.md"),
    ServiceReference.SURGICAL_EVALUATION: Path(
        "references/services/surgical-evaluation.md"
    ),
    ServiceReference.GENERAL_CONSULT: Path("references/services/general-consult.md"),
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

    return _skill_directory(skill_name).joinpath("SKILL.md").read_text(encoding="utf-8")


def load_references(
    skill_name: ClinicalSkillName,
    selection: ReferenceSelection,
) -> dict[str, str]:
    """Load selected references keyed only by their logical IDs."""

    skill_directory = _skill_directory(skill_name)
    references = tuple(
        reference
        for reference in (selection.condition, selection.service)
        if reference is not None
    )
    return {
        reference.value: skill_directory.joinpath(REFERENCE_FILES[reference]).read_text(
            encoding="utf-8"
        )
        for reference in references
    }


def compile_requirements(
    skill_instructions: str,
    reference_contents: dict[str, str],
) -> list[RequirementDefinition]:
    """Compile skill and reference frontmatter into one ordered definition list."""

    sources = [("skill", skill_instructions), *sorted(reference_contents.items())]
    requirements: list[RequirementDefinition] = []
    seen: set[str] = set()

    for source, content in sources:
        for item in _requirement_metadata(content).get("requirements", []):
            requirement = RequirementDefinition.model_validate(
                {**item, "source": source}
            )
            if requirement.id in seen:
                raise ValueError(f"Duplicate requirement ID: {requirement.id}")
            seen.add(requirement.id)
            requirements.append(requirement)

    if not requirements:
        raise ValueError("Selected clinical skill contains no requirements.")
    return requirements


def _skill_directory(skill_name: ClinicalSkillName) -> Path:
    definition = next(skill for skill in SKILLS if skill.name is skill_name)
    return SKILLS_ROOT / definition.directory


def _normalize(value: str | None) -> str:
    return value.strip().casefold() if value else ""


def _requirement_metadata(content: str) -> dict[str, object]:
    """Read the YAML block under a Markdown requirement-definitions heading."""

    marker = "## Requirement definitions\n\n```yaml\n"
    if marker not in content:
        return {}
    yaml_block = content.split(marker, maxsplit=1)[1].split("\n```", maxsplit=1)[0]
    return yaml.safe_load(yaml_block) or {}

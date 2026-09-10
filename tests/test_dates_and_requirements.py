"""Birth-date round trips and compiled checklist coverage."""

import json
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from referral_intake.clinical_requirements.catalog import (
    compile_requirements,
    load_references,
    load_skill_instructions,
)
from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ReferenceSelection,
)
from referral_intake.models import ExtractedPatient, Patient


@pytest.mark.parametrize("value", ["02-29-2000", "2000-02-29", date(2000, 2, 29)])
def test_birth_date_calendar_and_serialization(value):
    extracted = ExtractedPatient(date_of_birth=value)
    assert extracted.date_of_birth == date(2000, 2, 29)
    assert extracted.model_dump(mode="json")["date_of_birth"] == "02-29-2000"
    patient = Patient(
        **extracted.model_dump(exclude={"first_name", "last_name", "sex"}),
        first_name="Test",
        last_name="Patient",
        sex="Female",
    )
    assert patient.date_of_birth == date(2000, 2, 29)
    assert patient.model_dump(mode="json")["date_of_birth"] == "02-29-2000"


@pytest.mark.parametrize("value", ["02-29-2001", "13-01-2000", "04-31-2000", 20000229])
def test_invalid_birth_dates_are_rejected(value):
    with pytest.raises(ValidationError):
        ExtractedPatient(date_of_birth=value)


def test_birth_date_schema_and_missing_value():
    schema = ExtractedPatient.model_json_schema()["properties"]["date_of_birth"]
    string = next(item for item in schema["anyOf"] if item["type"] == "string")
    assert string["pattern"] == r"^\d{2}-\d{2}-\d{4}$"
    assert "format" not in string  # JSON Schema date would force ISO ordering.
    assert ExtractedPatient(date_of_birth=None).date_of_birth is None


def test_fixture_checklists_match_compiled_requirements():
    suite = Path(__file__).resolve().parents[1] / "knee_test_suite/answer_key.json"
    cases = json.loads(suite.read_text())["cases"]
    common = load_skill_instructions(ClinicalSkillName.KNEE)
    shared_ids = {r.id for r in compile_requirements(common, {})}
    for case in cases:
        selection = ReferenceSelection(
            condition=case["condition_reference"],
            service=case["service_reference"],
        )
        refs = load_references(ClinicalSkillName.KNEE, selection)
        compiled = compile_requirements(common, refs)
        ids = [r.id for r in compiled]
        assert len(ids) == len(set(ids))
        assert set(case["requirements"]) == set(ids)
        assert all(sum(r.id == id for r in compiled) == 1 for id in shared_ids)
    expected_gaps = {
        "KNEE-102": "imaging.knee_summary",
        "KNEE-103": "history.knee",
        "KNEE-106": "treatment.history_response",
    }
    for case in cases:
        if case["packet_id"] in expected_gaps:
            assert (
                case["requirements"][expected_gaps[case["packet_id"]]]["status"]
                == "not documented"
            )

"""The extraction contract constrains categories without forcing unsupported inputs."""

import pytest
from pydantic import ValidationError

from referral_intake.enums import (
    Condition,
    Priority,
    ReferralReason,
    Service,
    Specialty,
    Subspecialty,
)
from referral_intake.models import ReferralExtraction

CATEGORIES = {
    "specialty": Specialty,
    "subspecialty": Subspecialty,
    "service": Service,
    "condition": Condition,
    "priority": Priority,
    "reason_for_referral": ReferralReason,
}


@pytest.mark.parametrize("field,enum", CATEGORIES.items())
def test_categories_are_constrained_and_nullable(field, enum):
    schema = ReferralExtraction.model_json_schema()
    alternatives = schema["properties"][field]["anyOf"]
    assert {"type": "null"} in alternatives
    definition = schema["$defs"][enum.__name__]
    assert definition["enum"] == [value.value for value in enum]
    payload = dict(patient={}, insurance={}, provider={}, referring_provider={})
    for value in enum:
        assert (
            getattr(ReferralExtraction(**payload, **{field: value.value}), field)
            == value
        )
    assert getattr(ReferralExtraction(**payload, **{field: None}), field) is None
    with pytest.raises(ValidationError):
        ReferralExtraction(**payload, **{field: "unsupported category"})

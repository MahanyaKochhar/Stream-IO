"""Validated birth dates with a month-first structured-output contract."""

import re
from datetime import date, datetime
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema


def parse_birth_date(value: object) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        if re.fullmatch(r"\d{2}-\d{2}-\d{4}", value):
            return datetime.strptime(value, "%m-%d-%Y").date()
        # Read previously saved ISO dates without changing their calendar date.
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return date.fromisoformat(value)
    raise ValueError("Date of birth must be a valid MM-DD-YYYY date.")


BirthDate = Annotated[
    date,
    BeforeValidator(parse_birth_date),
    PlainSerializer(lambda value: value.strftime("%m-%d-%Y"), return_type=str),
    WithJsonSchema({"type": "string", "pattern": r"^\d{2}-\d{2}-\d{4}$"}),
]

"""PostgreSQL checkpointing for durable LangGraph runs."""

import os
from collections.abc import Iterator
from contextlib import contextmanager

from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg import Connection
from psycopg.rows import dict_row

from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ConditionReference,
    ReferenceSelection,
    ServiceReference,
)
from referral_intake.models import (
    ExtractedInsurance,
    ExtractedPatient,
    Insurance,
    Patient,
    Provider,
    ReferralExtraction,
    ReferralType,
)


@contextmanager
def postgres_checkpointer() -> Iterator[PostgresSaver]:
    """Create and initialize the configured PostgreSQL checkpointer."""

    load_dotenv()
    uri = os.getenv("POSTGRES_URI")
    if not uri:
        raise RuntimeError("POSTGRES_URI is not configured in .env.")

    serializer = JsonPlusSerializer(
        allowed_msgpack_modules=[
            ExtractedInsurance,
            ExtractedPatient,
            Insurance,
            Patient,
            Provider,
            ReferralExtraction,
            ReferralType,
            ClinicalSkillName,
            ConditionReference,
            ReferenceSelection,
            ServiceReference,
        ]
    )
    with Connection.connect(
        uri,
        autocommit=True,
        prepare_threshold=0,
        row_factory=dict_row,
    ) as connection:
        checkpointer = PostgresSaver(connection, serde=serializer)
        checkpointer.setup()
        yield checkpointer

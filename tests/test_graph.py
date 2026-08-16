from datetime import date
from pathlib import Path

import pytest

from referral_intake.extraction import referral_output_schema, validate_extraction
from referral_intake.gemini import GeminiReferralExtractor
from referral_intake.graph import build_graph
from referral_intake.models import (
    ExtractedInsurance,
    ExtractedPatient,
    Provider,
    ReferralExtraction,
)
from referral_intake.runtime import GraphContext


class StubParser:
    def parse(self, pdf_path: Path) -> str:
        assert pdf_path == Path("referral.pdf")
        return "# Synthetic referral"


class StubExtractor:
    def __init__(self, result: ReferralExtraction) -> None:
        self.result = result

    def extract(self, markdown: str) -> ReferralExtraction:
        assert markdown == "# Synthetic referral"
        return self.result


def extraction(**overrides: object) -> ReferralExtraction:
    values: dict[str, object] = {
        "patient": ExtractedPatient(
            first_name="Michael",
            last_name="Turner",
            date_of_birth=date(1974, 11, 22),
            phone="321-555-8432",
        ),
        "insurance": ExtractedInsurance(
            payer_name="Sunshine Health PPO",
            member_id="SHP-88294317",
            group_number="GRP-29018",
        ),
        "provider": Provider(name="First Available"),
        "referring_provider": Provider(
            name="Emily Patel, MD",
            npi="1888888881",
            organization="Greenfield Primary Care",
        ),
        "specialty": "Orthopedic Surgery",
        "subspecialty": "Knee",
        "service": "Consultation; Evaluate and Treat",
    }
    values.update(overrides)
    return ReferralExtraction.model_validate(values)


def run_graph(result: ReferralExtraction) -> dict[str, object]:
    graph = build_graph()
    context = GraphContext(parser=StubParser(), extractor=StubExtractor(result))
    return graph.invoke({"pdf_path": "referral.pdf"}, context=context)


def test_stream_reports_each_completed_node() -> None:
    graph = build_graph()
    context = GraphContext(parser=StubParser(), extractor=StubExtractor(extraction()))

    parts = list(
        graph.stream(
            {"pdf_path": "referral.pdf"},
            context=context,
            stream_mode=["updates", "values"],
            version="v2",
        )
    )
    completed_nodes = [
        node_name
        for part in parts
        if part["type"] == "updates"
        for node_name in part["data"]
    ]
    final_state = [
        part["data"] for part in parts if part["type"] == "values"
    ][-1]

    assert completed_nodes == [
        "parse_pdf",
        "extract_fields",
        "check_routing",
        "validate_patient",
        "validate_insurance",
    ]
    assert final_state["outcome"] == "ready_for_next_stage"


def test_valid_referral_reaches_next_stage() -> None:
    result = run_graph(extraction())

    assert result["outcome"] == "ready_for_next_stage"
    assert result["patient"].last_name == "Turner"
    assert result["insurance"].member_id == "SHP-88294317"
    assert result["missing_fields"] == []


def test_routing_mismatch_is_rejected() -> None:
    result = run_graph(extraction(subspecialty="Spine"))

    assert result["outcome"] == "rejected"
    assert "subspecialty" in result["message"]
    assert "patient" not in result


def test_provider_does_not_affect_routing() -> None:
    result = run_graph(extraction(provider=Provider(name="Unlisted Provider")))

    assert result["outcome"] == "ready_for_next_stage"
    assert result["extracted"].provider.name == "Unlisted Provider"


def test_missing_patient_data_routes_to_missing_information() -> None:
    patient = ExtractedPatient(
        first_name="Michael",
        last_name="Turner",
        date_of_birth=None,
    )
    result = run_graph(extraction(patient=patient))

    assert result["outcome"] == "needs_information"
    assert result["missing_fields"] == ["patient.date_of_birth"]
    assert "insurance" not in result


def test_missing_insurance_data_routes_to_missing_information() -> None:
    insurance = ExtractedInsurance(
        payer_name="Sunshine Health PPO",
        member_id=None,
    )
    result = run_graph(extraction(insurance=insurance))

    assert result["outcome"] == "needs_information"
    assert result["patient"].last_name == "Turner"
    assert result["missing_fields"] == ["insurance.member_id"]
    assert "insurance" not in result


def test_provider_neutral_structured_output_contract() -> None:
    schema = referral_output_schema()
    result = validate_extraction(extraction().model_dump(mode="json"))

    assert set(schema["properties"]) == {
        "patient",
        "insurance",
        "provider",
        "referring_provider",
        "specialty",
        "subspecialty",
        "service",
    }
    assert result.patient.last_name == "Turner"


def test_graph_context_uses_gemini_by_default() -> None:
    assert isinstance(GraphContext().extractor, GeminiReferralExtractor)


def test_gemini_extractor_uses_native_structured_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = extraction()

    class StubStructuredModel:
        def invoke(self, prompt: str) -> ReferralExtraction:
            assert "<referral>\n# Synthetic referral\n</referral>" in prompt
            return expected

    class StubChatGoogleGenerativeAI:
        def __init__(self, *, model: str, max_retries: int) -> None:
            assert model == "gemini-3.7-flash"
            assert max_retries == 2

        def with_structured_output(
            self,
            schema: type[ReferralExtraction],
            *,
            method: str,
        ) -> StubStructuredModel:
            assert schema is ReferralExtraction
            assert method == "json_schema"
            return StubStructuredModel()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.7-flash")
    monkeypatch.setattr(
        "referral_intake.gemini.ChatGoogleGenerativeAI",
        StubChatGoogleGenerativeAI,
    )

    result = GeminiReferralExtractor().extract("# Synthetic referral")

    assert result == expected

from datetime import date
from pathlib import Path

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from referral_intake.clinical_requirements.catalog import (
    compile_requirements,
    load_references,
    load_skill_instructions,
    select_skill,
)
from referral_intake.clinical_requirements.models import (
    ClinicalSkillName,
    ConditionReference,
    ReferenceSelection,
    ReferralDecision,
    RequirementDefinition,
    RequirementExtraction,
    RequirementFinding,
    RequirementStatus,
    ServiceReference,
)
from referral_intake.dependencies import GraphDependencies
from referral_intake.extraction import referral_output_schema, validate_extraction
from referral_intake.graph import build_graph
from referral_intake.llm import (
    StructuredReferenceSelector,
    StructuredReferralExtractor,
    StructuredRequirementExtractor,
)
from referral_intake.models import (
    ExtractedInsurance,
    ExtractedPatient,
    Provider,
    ReferralExtraction,
    ReferralType,
)
from referral_intake.server import graph as server_graph


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


class StubReferenceSelector:
    def select(
        self,
        skill_instructions: str,
        condition: str | None,
        service: str | None,
        reason_for_referral: str | None,
    ) -> ReferenceSelection:
        assert "# Knee Referral Intake" in skill_instructions
        assert condition == "Meniscus tear"
        assert service == "Consultation; Evaluate and Treat"
        assert reason_for_referral == (
            "Persistent right knee pain after twisting injury."
        )
        return ReferenceSelection(
            condition=ConditionReference.MENISCUS_TEAR,
            service=ServiceReference.GENERAL_CONSULT,
        )


class StubRequirementExtractor:
    def extract(
        self,
        markdown: str,
        requirements: list[RequirementDefinition],
    ) -> RequirementExtraction:
        assert markdown == "# Synthetic referral"
        assert requirements
        return RequirementExtraction(
            findings=[
                RequirementFinding(
                    requirement_id=requirement.id,
                    status=RequirementStatus.NOT_DOCUMENTED,
                )
                for requirement in requirements
            ]
        )


def extraction(**overrides: object) -> ReferralExtraction:
    values: dict[str, object] = {
        "patient": ExtractedPatient(
            first_name="Michael",
            last_name="Turner",
            date_of_birth=date(1974, 11, 22),
            sex="Male",
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
        "condition": "Meniscus tear",
        "priority": "Routine",
        "reason_for_referral": ("Persistent right knee pain after twisting injury."),
        "referral_type": ReferralType.MENISCUS_INTERNAL_DERANGEMENT,
    }
    values.update(overrides)
    return ReferralExtraction.model_validate(values)


def run_graph(
    result: ReferralExtraction,
    decision: str = "approve",
) -> dict[str, object]:
    dependencies = GraphDependencies(
        parser=StubParser(),
        extractor=StubExtractor(result),
        reference_selector=StubReferenceSelector(),
        requirement_extractor=StubRequirementExtractor(),
    )
    graph = build_graph(
        checkpointer=InMemorySaver(),
        dependencies=dependencies,
    )
    config = {"configurable": {"thread_id": "clinical-review-test"}}
    paused = graph.invoke(
        {"pdf_path": "referral.pdf"},
        config=config,
    )
    if "__interrupt__" not in paused:
        return paused
    review_interrupt = paused["__interrupt__"][0]
    assert review_interrupt.value["options"] == ["approve", "reject"]
    assert review_interrupt.value["requirements"]
    return graph.invoke(
        Command(resume={review_interrupt.id: decision}),
        config=config,
    )


def test_stream_reports_each_completed_node() -> None:
    dependencies = GraphDependencies(
        parser=StubParser(),
        extractor=StubExtractor(extraction()),
        reference_selector=StubReferenceSelector(),
        requirement_extractor=StubRequirementExtractor(),
    )
    graph = build_graph(
        checkpointer=InMemorySaver(),
        dependencies=dependencies,
    )

    config = {"configurable": {"thread_id": "stream-test"}}
    parts = list(
        graph.stream(
            {"pdf_path": "referral.pdf"},
            config=config,
            stream_mode=["updates", "values"],
            subgraphs=True,
            version="v2",
        )
    )
    completed_nodes = [
        node_name
        for part in parts
        if part["type"] == "updates"
        for node_name in part["data"]
        if node_name != "__interrupt__"
    ]

    assert completed_nodes == [
        "parse_pdf",
        "extract_fields",
        "check_routing",
        "validate_patient",
        "validate_insurance",
        "select_skill",
        "load_skill",
        "select_references",
        "load_references",
        "compile_requirements",
        "extract_requirement_values",
    ]
    request = next(
        part["data"]["__interrupt__"][0].value
        for part in parts
        if part["type"] == "updates" and "__interrupt__" in part["data"]
    )
    assert request["options"] == ["approve", "reject"]

    resumed_parts = list(
        graph.stream(
            Command(resume="approve"),
            config=config,
            stream_mode=["updates", "values"],
            subgraphs=True,
            version="v2",
        )
    )
    resumed_nodes = [
        node_name
        for part in resumed_parts
        if part["type"] == "updates"
        for node_name in part["data"]
    ]
    final_state = [part["data"] for part in resumed_parts if part["type"] == "values"][
        -1
    ]

    assert resumed_nodes == [
        "review_referral_packet",
        "clinical_requirements",
    ]
    parent_update = next(
        part["data"]["clinical_requirements"]
        for part in resumed_parts
        if part["type"] == "updates" and "clinical_requirements" in part["data"]
    )
    assert set(parent_update) == {"clinical_requirements", "outcome"}
    assert final_state["outcome"] == "referral_approved"


def test_server_graph_exposes_minimal_public_schema() -> None:
    assert server_graph.get_input_jsonschema()["required"] == ["pdf_path"]
    assert server_graph.get_context_jsonschema() is None


def test_server_graph_exposes_command_routes() -> None:
    graph = server_graph.get_graph()
    routes = {(edge.source, edge.target) for edge in graph.edges}

    assert ("parse_pdf", "extract_fields") in routes
    assert ("extract_fields", "check_routing") in routes
    assert ("check_routing", "validate_patient") in routes
    assert ("check_routing", "human_review") in routes


def test_valid_referral_reaches_next_stage() -> None:
    result = run_graph(extraction())

    assert result["outcome"] == "referral_approved"
    assert result["patient"].last_name == "Turner"
    assert result["patient"].sex == "Male"
    assert result["insurance"].member_id == "SHP-88294317"
    assert result["extracted"].reason_for_referral == (
        "Persistent right knee pain after twisting injury."
    )
    assert "reason_for_referral" not in result
    assert result["missing_fields"] == []
    clinical = result["clinical_requirements"]
    assert clinical.skill is ClinicalSkillName.KNEE
    assert clinical.references == ReferenceSelection(
        condition=ConditionReference.MENISCUS_TEAR,
        service=ServiceReference.GENERAL_CONSULT,
    )
    requirement_ids = {requirement.id for requirement in clinical.requirements}
    assert "knee.affected_side" in requirement_ids
    assert "meniscus.mechanical_symptoms" in requirement_ids
    assert "consult.question" in requirement_ids
    assert {finding.requirement_id for finding in clinical.findings} == requirement_ids
    assert clinical.decision is ReferralDecision.APPROVE
    assert "selected_skill" not in result
    assert "skill_instructions" not in result
    assert "selected_references" not in result
    assert "reference_contents" not in result
    assert "compiled_requirements" not in result


def test_skill_selection_uses_only_specialty_and_subspecialty() -> None:
    assert select_skill("Orthopedic Surgery", "Knee") is ClinicalSkillName.KNEE
    assert select_skill("orthopaedics", "knee") is ClinicalSkillName.KNEE


def test_reference_loader_accepts_no_clear_reference_match() -> None:
    assert load_references(ClinicalSkillName.KNEE, ReferenceSelection()) == {}


def test_knee_skill_routes_to_every_loadable_reference() -> None:
    instructions = load_skill_instructions(ClinicalSkillName.KNEE)

    for condition in ConditionReference:
        assert f"`{condition.value}`" in instructions
        contents = load_references(
            ClinicalSkillName.KNEE,
            ReferenceSelection(condition=condition),
        )
        assert set(contents) == {condition.value}

    for service in ServiceReference:
        assert f"`{service.value}`" in instructions
        contents = load_references(
            ClinicalSkillName.KNEE,
            ReferenceSelection(service=service),
        )
        assert set(contents) == {service.value}


def test_requirements_compile_deterministically_from_selected_content() -> None:
    instructions = load_skill_instructions(ClinicalSkillName.KNEE)
    contents = load_references(
        ClinicalSkillName.KNEE,
        ReferenceSelection(
            condition=ConditionReference.MENISCUS_TEAR,
            service=ServiceReference.GENERAL_CONSULT,
        ),
    )

    requirements = compile_requirements(instructions, contents)

    assert requirements[0].id == "knee.affected_side"
    assert {requirement.source for requirement in requirements} == {
        "skill",
        "conditions/meniscus-tear",
        "services/general-consult",
    }
    assert len({requirement.id for requirement in requirements}) == len(requirements)


def test_human_can_reject_referral() -> None:
    result = run_graph(extraction(), decision="reject")

    assert result["outcome"] == "referral_rejected"
    assert result["clinical_requirements"].decision is ReferralDecision.REJECT


def test_routing_mismatch_pauses_for_human_review() -> None:
    dependencies = GraphDependencies(
        parser=StubParser(),
        extractor=StubExtractor(extraction(subspecialty="Spine")),
    )
    graph = build_graph(
        checkpointer=InMemorySaver(),
        dependencies=dependencies,
    )
    config = {"configurable": {"thread_id": "review-test"}}

    paused = graph.invoke(
        {"pdf_path": "referral.pdf"},
        config=config,
    )
    request = paused["__interrupt__"][0].value

    assert request["instruction"] == (
        "Review the routing mismatch and enter review text."
    )
    assert "subspecialty" in request["reason"]

    result = graph.invoke(
        Command(resume="Reviewed by intake coordinator."),
        config=config,
    )

    assert result["outcome"] == "human_reviewed"
    assert result["review_text"] == "Reviewed by intake coordinator."
    assert "patient" not in result


def test_provider_does_not_affect_routing() -> None:
    result = run_graph(extraction(provider=Provider(name="Unlisted Provider")))

    assert result["outcome"] == "referral_approved"
    assert result["extracted"].provider.name == "Unlisted Provider"


def test_missing_patient_data_routes_to_missing_information() -> None:
    patient = ExtractedPatient(
        first_name="Michael",
        last_name="Turner",
        date_of_birth=None,
        sex="Male",
    )
    result = run_graph(extraction(patient=patient))

    assert result["outcome"] == "needs_information"
    assert result["missing_fields"] == ["patient.date_of_birth"]
    assert "insurance" not in result


def test_missing_patient_sex_routes_to_missing_information() -> None:
    patient = ExtractedPatient(
        first_name="Michael",
        last_name="Turner",
        date_of_birth=date(1974, 11, 22),
        sex=None,
    )
    result = run_graph(extraction(patient=patient))

    assert result["outcome"] == "needs_information"
    assert result["missing_fields"] == ["patient.sex"]


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
        "condition",
        "priority",
        "reason_for_referral",
        "referral_type",
    }
    assert result.patient.last_name == "Turner"
    assert result.patient.sex == "Male"
    assert result.condition == "Meniscus tear"
    assert result.priority == "Routine"
    assert result.referral_type is ReferralType.MENISCUS_INTERNAL_DERANGEMENT
    assert "sex" in schema["$defs"]["ExtractedPatient"]["properties"]
    assert set(schema["$defs"]["ReferralType"]["enum"]) == {
        referral_type.value for referral_type in ReferralType
    }


def test_referral_type_rejects_unsupported_values() -> None:
    with pytest.raises(ValueError):
        extraction(referral_type="sports medicine")


def test_graph_dependencies_use_structured_llm_adapters_by_default() -> None:
    dependencies = GraphDependencies()

    assert isinstance(dependencies.extractor, StructuredReferralExtractor)
    assert isinstance(dependencies.reference_selector, StructuredReferenceSelector)
    assert isinstance(
        dependencies.requirement_extractor, StructuredRequirementExtractor
    )


def test_referral_extractor_uses_initialized_structured_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = extraction()

    class StubStructuredModel:
        def invoke(self, prompt: str) -> ReferralExtraction:
            assert "<referral>\n# Synthetic referral\n</referral>" in prompt
            return expected

    class StubChatModel:
        def with_structured_output(
            self,
            schema: type[ReferralExtraction],
            method: str,
        ) -> StubStructuredModel:
            assert schema is ReferralExtraction
            assert method == "json_schema"
            return StubStructuredModel()

    def stub_init_chat_model(
        model: str, model_provider: str, max_retries: int, api_key: str
    ) -> StubChatModel:
        assert model == "gpt-5-mini"
        assert model_provider == "openai"
        assert max_retries == 2
        assert api_key == "test-key"
        return StubChatModel()

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "gpt-5-mini")
    monkeypatch.setattr(
        "referral_intake.llm.init_chat_model",
        stub_init_chat_model,
    )

    result = StructuredReferralExtractor().extract("# Synthetic referral")

    assert result == expected


def test_reference_selector_reads_skill_and_returns_logical_ids(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = ReferenceSelection(
        condition=ConditionReference.MENISCUS_TEAR,
        service=ServiceReference.GENERAL_CONSULT,
    )

    class StubStructuredModel:
        def invoke(self, messages: list[tuple[str, str]]) -> ReferenceSelection:
            system_prompt = messages[0][1]
            referral_prompt = messages[1][1]
            assert "conditions/meniscus-tear" in system_prompt
            assert "services/general-consult" in system_prompt
            assert "Condition: Meniscus tear" in referral_prompt
            assert "Service: Consultation" in referral_prompt
            return expected

    class StubChatModel:
        def with_structured_output(
            self,
            schema: type[ReferenceSelection],
            method: str,
        ) -> StubStructuredModel:
            assert schema is ReferenceSelection
            assert method == "json_schema"
            return StubStructuredModel()

    def stub_init_chat_model(
        model: str, model_provider: str, max_retries: int, api_key: str
    ) -> StubChatModel:
        assert model == "gpt-5-mini"
        assert model_provider == "openai"
        assert max_retries == 2
        assert api_key == "test-key"
        return StubChatModel()

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "gpt-5-mini")
    monkeypatch.setattr(
        "referral_intake.llm.init_chat_model",
        stub_init_chat_model,
    )

    result = StructuredReferenceSelector().select(
        skill_instructions=(
            "Supported: conditions/meniscus-tear, services/general-consult"
        ),
        condition="Meniscus tear",
        service="Consultation",
        reason_for_referral="Knee pain",
    )

    assert result == expected


def test_requirement_extractor_uses_compiled_definitions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requirement = RequirementDefinition(
        id="meniscus.mechanical_symptoms",
        description="Catching, clicking, locking, or giving way.",
        source="conditions/meniscus-tear",
    )
    expected = RequirementExtraction(
        findings=[
            RequirementFinding(
                requirement_id=requirement.id,
                status=RequirementStatus.DOCUMENTED,
                value="Intermittent catching; denies locking or giving way.",
            )
        ]
    )

    class StubStructuredModel:
        def invoke(self, messages: list[tuple[str, str]]) -> RequirementExtraction:
            prompt = messages[1][1]
            assert '"id": "meniscus.mechanical_symptoms"' in prompt
            assert "# Synthetic referral" in prompt
            assert "conditions/meniscus-tear" not in prompt
            return expected

    class StubChatModel:
        def with_structured_output(
            self,
            schema: type[RequirementExtraction],
            method: str,
        ) -> StubStructuredModel:
            assert schema is RequirementExtraction
            assert method == "json_schema"
            return StubStructuredModel()

    def stub_init_chat_model(
        model: str, model_provider: str, max_retries: int, api_key: str
    ) -> StubChatModel:
        return StubChatModel()

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "gpt-5-mini")
    monkeypatch.setattr(
        "referral_intake.llm.init_chat_model",
        stub_init_chat_model,
    )

    result = StructuredRequirementExtractor().extract(
        markdown="# Synthetic referral",
        requirements=[requirement],
    )

    assert result == expected

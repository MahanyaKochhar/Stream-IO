# Referral Intake Agent

An initial LangGraph workflow for receiving-provider referral intake. The graph
parses a referral PDF with LlamaParse, extracts a small structured referral
object through LangChain's provider-neutral `init_chat_model`, checks routing,
validates the patient and insurance data, then selects and loads a clinical
requirements skill, compiles its requirements, and extracts their values in a
nested subgraph.

Each node owns its next transition with a typed LangGraph `Command`. The graph
builder declares only the required `START` entry edge.

The initial skill catalog contains only `orthopedics/knee`. Skill selection is a
deterministic specialty/subspecialty lookup. A deterministic node loads its
`SKILL.md`, a structured-output call selects supported condition and service
reference IDs. Deterministic nodes load the selected files and compile their
stable requirement definitions. A second structured-output call extracts one
finding per requirement from the referral Markdown before the graph pauses for a
human to approve or reject the packet. The parent receives one top-level
`clinical_requirements` result; loaded Markdown and other working state remain
private to the subgraph. Deterministic finding validation, plan generation,
execution, treatment-plan, and scheduling behavior are not yet implemented.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

Add your LlamaCloud, Gemini, and PostgreSQL settings to `.env`:

```dotenv
LLAMA_CLOUD_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=google_genai
LLM_MODEL=gemini-3.7-flash
POSTGRES_URI=postgresql://user:password@localhost:5432/referrals
```

The LLM adapters pass `GEMINI_API_KEY` to the configured provider, use LangChain
structured output, and validate the response as a Pydantic `ReferralExtraction`
before it enters graph state. The runner calls
`PostgresSaver.setup()` to create or migrate LangGraph's checkpoint tables.

## Graph execution

```python
from referral_intake.graph import build_graph
from referral_intake.persistence import postgres_checkpointer
from referral_intake.runtime import GraphContext

config = {"configurable": {"thread_id": "referral-123"}}
with postgres_checkpointer() as checkpointer:
    graph = build_graph(checkpointer=checkpointer)
    for part in graph.stream(
        {"pdf_path": "referral.pdf"},
        config=config,
        context=GraphContext(),
        stream_mode="updates",
        subgraphs=True,
        version="v2",
    ):
        print(part["data"])
```

Use `invoke()` when only the final state is needed. Use `stream()` with
`stream_mode="updates"` and `subgraphs=True` to observe both parent and subgraph
node updates. The `main.py` runner retains the latest `values` event so it can
print the final state without executing the graph a second time.

See [the workflow baseline](docs/referral-intake-agent-flow.md) for the node
diagram and [the tests](tests/test_graph.py) for complete in-memory examples.

## Run the graph

Set `PDF_PATH` in `main.py`, then run the real graph:

```bash
python main.py
```

The entry point prints every completed node and the final graph state. A routing
mismatch pauses at `human_review` for reviewer text. A clinically processed
packet pauses at `review_referral_packet` for an `approve` or `reject` decision.
Both resume with the same checkpoint thread. Both cloud API keys and
`POSTGRES_URI` are required for a complete run.

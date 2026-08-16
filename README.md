# Referral Intake Agent

An initial LangGraph workflow for receiving-provider referral intake. The graph
parses a referral PDF with LlamaParse, extracts a small structured referral
object with Gemini through LangChain's `ChatGoogleGenerativeAI`, checks routing,
and validates the patient and insurance data.

Each node owns its next transition with a typed LangGraph `Command`. The graph
builder declares only the required `START` entry edge.

The current workflow ends when the referral is ready for the next stage,
requires missing information, or fails the basic routing check. Treatment-plan
and scheduling behavior are intentionally not implemented yet.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

Add your LlamaCloud and Gemini keys to `.env`:

```dotenv
LLAMA_CLOUD_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.7-flash
```

`GOOGLE_API_KEY` is also accepted in place of `GEMINI_API_KEY`. The structured
extractor uses Gemini native JSON-schema output and validates the response as a
Pydantic `ReferralExtraction` before it enters graph state.

## Graph execution

```python
from referral_intake.graph import build_graph
from referral_intake.runtime import GraphContext

graph = build_graph()
for part in graph.stream(
    {"pdf_path": "referral.pdf"},
    context=GraphContext(),
    stream_mode="updates",
    version="v2",
):
    if part["type"] == "updates":
        print(part["data"])
```

Use `invoke()` when only the final state is needed. Use `stream()` with
`stream_mode="updates"` to observe each node update as the graph runs. The
`main.py` runner streams node updates and retains the latest `values` event so
it can print the final state without executing the graph a second time.

See [the workflow baseline](docs/referral-intake-agent-flow.md) for the node
diagram and [the tests](tests/test_graph.py) for complete in-memory examples.

## Run the graph

Set `PDF_PATH` in `main.py`, then run the real graph:

```bash
python main.py
```

The entry point prints every completed node and the final graph state. It uses
the real `GraphContext`, so both cloud API keys are required for a complete run.

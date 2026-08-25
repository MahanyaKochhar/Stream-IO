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

Add your LlamaCloud and Gemini settings to `.env`:

```dotenv
LLAMA_CLOUD_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=google_genai
LLM_MODEL=gemini-3.7-flash
```

The LLM adapters pass `GEMINI_API_KEY` to the configured provider, use LangChain
structured output, and validate the response as a Pydantic `ReferralExtraction`
before it enters graph state.

## LangGraph Agent Server

The repository exposes the graph as `referral_intake` through
`langgraph.json`. Start the development server with:

```bash
python -m pip install -e '.[dev]'
langgraph dev --no-browser
```

The API is available at `http://localhost:2024`. Agent Server manages streaming,
threads, checkpoints, and interrupt resumption; no custom FastAPI or SSE layer is
needed. Local `langgraph dev` uses its development persistence. The explicit
checkpoint lifecycle is owned by Agent Server.

The exported graph creates one `GraphDependencies` container and binds it to
the node functions when the server imports the graph. Parsers, model adapters,
and routing policy therefore stay outside checkpointed referral state without
requiring a JSON runtime context.

A future React frontend can connect directly with `@langchain/react`:

```tsx
import { useStream } from "@langchain/react";

type ReferralState = {
  pdf_path: string;
  outcome?: string;
  clinical_requirements?: unknown;
};

const stream = useStream<ReferralState>({
  apiUrl: "http://localhost:2024",
  assistantId: "referral_intake",
});

await stream.submit({ pdf_path: "referral_packet.pdf" });
await stream.respond("approve");
```

`pdf_path` currently refers to a file already available to the server. Browser
file upload or object-storage ingestion will be added separately when the
frontend is implemented.

See [the workflow baseline](docs/referral-intake-agent-flow.md) for the node
diagram and [the tests](tests/test_graph.py) for complete in-memory examples.

## Run the graph

Start the LangGraph development server:

```bash
langgraph dev --no-browser
```

Use LangGraph Studio or a `useStream` frontend to submit a referral and observe
node updates. A routing mismatch pauses at `human_review` for reviewer text. A
clinically processed packet pauses at `review_referral_packet` for an `approve`
or `reject` decision. Agent Server resumes both through the same thread.

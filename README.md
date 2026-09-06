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
finding per requirement from the referral Markdown. The subgraph returns its
draft, then the parent graph pauses so a coordinator can edit findings and
approve or reject the packet. Loaded Markdown and other working state remain
private to the subgraph. Deterministic finding validation, plan generation,
execution, treatment-plan, and scheduling behavior are not yet implemented.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

Add your LlamaCloud and UF Navigator settings to `.env`:

```dotenv
LLAMA_CLOUD_API_KEY=
NAVIGATOR_API_KEY=
NAVIGATOR_MODEL=
```

The active LLM adapters use UF Navigator's OpenAI-compatible endpoint with
LangChain structured output and validate the response as a Pydantic
`ReferralExtraction` before it enters graph state. The provider-neutral
`llm.py` adapter remains available but is not currently wired into the graph.

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

The React frontend in `frontend/` connects directly with `@langchain/react`:

```tsx
import { useStream } from "@langchain/react";

type ReferralState = {
  pdf_path: string;
  ui?: UIMessage[];
  outcome?: string;
  clinical_requirements?: unknown;
};

const stream = useStream<ReferralState>({
  apiUrl: "http://localhost:2024",
  assistantId: "referral_intake",
});

await stream.submit({ pdf_path: "referral_packet.pdf" });
await stream.respond({ decision: "approve", findings: editedFindings });
```

Nodes emit trusted LangGraph UI messages into `stream.values.ui`. A frontend
component registry maps each message name to an AI Elements component, including
editable clinical findings and the terminal assistant response. No private model
reasoning is exposed.

For local development, the frontend upload route stores the PDF in the system
temporary directory and submits that server-readable path to the graph. Replace
this handoff with private object storage before deploying the two services on
separate hosts.

## Frontend

Start Agent Server first, then run the Next.js workspace in another terminal:

```bash
langgraph dev --no-browser
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard reads persisted Agent Server
threads, groups running and completed referrals, opens individual referral
details, and starts new graph runs from its AI Elements upload chat. Human
review resumes the same thread through `useStream.respond()`.

See [the workflow baseline](docs/referral-intake-agent-flow.md) for the node
diagram and [the tests](tests/test_graph.py) for complete in-memory examples.

## Run the graph

Start the LangGraph development server:

```bash
langgraph dev --no-browser
```

Use LangGraph Studio or a `useStream` frontend to submit a referral and observe
node updates. A routing mismatch pauses at `human_review` for reviewer text. A
clinically processed packet pauses at the parent `review_referral_packet` node.
Its structured response contains the edited findings and the `approve` or
`reject` decision. Agent Server resumes both through the same thread.

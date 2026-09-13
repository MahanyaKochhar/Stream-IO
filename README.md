# Referral Intake Agent

LangGraph intake for a receiving practice: parse a PDF with LlamaParse, classify
referral intent, extract fields, validate routing and required data, and prepare
clinical findings for coordinator review. LLM calls use UF Navigator. The current
clinical catalog supports orthopedic knee referrals.

See the [workflow](docs/referral-intake-agent-flow.md) for node behavior and state.

## Setup

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

Set the parser, model, and local Agent Server credentials in `.env`:

```dotenv
LLAMA_CLOUD_API_KEY=
NAVIGATOR_API_KEY=
NAVIGATOR_MODEL=
LANGSMITH_API_KEY=
```

Classification and extraction share the Navigator model configuration.

## Run the app

Start Docker, then run from the repository root:

```bash
.venv/bin/langgraph up --wait --docker-compose compose.local.yml
```

The backend runs at `http://localhost:8123`; `--wait` returns when its containers
are healthy. Set this value in `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_LANGGRAPH_API_URL=http://127.0.0.1:8123
```

Then start the UI:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Each PDF starts a new thread. Non-referral documents
end with “Not a referral document.” Referral reviews resume the same thread.

## Restart, rebuild, and storage

Start existing stopped containers with Docker Desktop or:

```bash
docker start stream-langgraph-postgres-1 stream-langgraph-redis-1 stream-langgraph-api-1
```

After backend code or dependency changes, rerun the `langgraph up` command above,
including the Compose file. Restarting alone keeps the packaged code unchanged.

- PostgreSQL stores threads and checkpoints; keep its volume to retain them.
- Next.js saves PDFs in repo-local `data/uploads`. The Compose file mounts it
  read-only as `/uploads` in the backend; the UI translates paths for PDF viewing.
- Agent Server manages checkpointing. No database connection or checkpointer is
  required in graph code. PDF files are separate from database state.

## Backend-only development

```bash
.venv/bin/langgraph dev --no-browser
```

This runs on port `2024` and saves state in `.langgraph_api`. Submit a host-readable
PDF path through Studio or the SDK. The UI's `/uploads` paths require the Docker
mount and do not work unchanged with this mode.

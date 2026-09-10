# Referral Intake Frontend

Next.js, React, TypeScript, Tailwind CSS, AI Elements, and LangGraph
`useStream` power the referral intake workspace.

## Run locally

Start the repository's LangGraph Agent Server at `http://127.0.0.1:2024`, then:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

`NEXT_PUBLIC_LANGGRAPH_API_URL` controls the Agent Server URL. The local upload
route writes PDFs to `../data/uploads/` at the repository root (ignored by Git),
creating the folder automatically. The local graph process reads the same files.
Run the frontend commands from this `frontend/` directory.
Use private object storage and authenticated server endpoints in
production.

## Checks

```bash
npm run lint
npm run build
```

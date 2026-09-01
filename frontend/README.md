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
route writes PDFs to the system temporary directory so the local graph process
can read them. Use private object storage and authenticated server endpoints in
production.

## Checks

```bash
npm run lint
npm run build
```

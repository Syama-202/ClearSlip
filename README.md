# ClearSlip

Understand an Indian payslip in plain language. Paste the text, upload a photo or PDF, and ClearSlip breaks down every earning and deduction, estimates your tax (New Regime, FY 2025-26) and lists concrete next steps. **Ask ClearSlip** answers follow-up questions with retrieval-augmented generation: answers cite passages from a knowledge base of Indian tax rules, and every number comes from ClearSlip's tax calculators via LLM tool calls.

- **Backend** — [clearslip-backend](clearslip-backend): Express API. Free self-hosted OCR (Tesseract.js / pdf-parse) feeds a deterministic rules engine; an optional free-tier LLM (Groq) handles inputs the rules can't read.
- **Frontend** — [clearslip-frontend-final/clearslip](clearslip-frontend-final/clearslip): React + Vite + Tailwind.
- **Docs** — [ClearSlip_Project_Documentation.md](ClearSlip_Project_Documentation.md): architecture, formulas, testing, limitations.

## Run locally

Copy each `.env.example` to `.env` (all backend variables are optional), then in two terminals:

```bash
cd clearslip-backend && npm install && npm run dev
```

```bash
cd clearslip-frontend-final/clearslip && npm install && npm run dev
```

Open http://localhost:5173. The backend defaults to port 4000. If that port is taken, set `PORT` in `clearslip-backend/.env` and point `VITE_API_URL` in the frontend `.env` at it.

Run the tests (166, Jest + Supertest):

```bash
cd clearslip-backend && npm test
```

## Optional features

The server reports which are on at `GET /api/health` (`features`) and in its startup log; the UI hides or explains whatever is off.

| Feature | Needs | Without it |
|---|---|---|
| "Describe it" mode and free-form questions | `GROQ_API_KEY` (free at console.groq.com) | Describe mode shows a note; inputs the rules engine can't read get a "paste your payslip lines" message |
| "Email checklist" button | `N8N_WEBHOOK_URL` (+ `N8N_SECRET`) | Button hidden |
| AI answers in Ask ClearSlip | `GROQ_API_KEY` | "Sources only" mode — shows the matching knowledge-base passages |
| Embedding (dense) retrieval | on by default; `RAG_DENSE=off` to disable | BM25 keyword retrieval only |

### Ask ClearSlip knowledge base

Documents live in `clearslip-backend/src/rag/corpus/` (one `##` section per passage). After editing them, rebuild the embeddings and re-run the evaluation:

```bash
cd clearslip-backend && npm run rag:index && npm run rag:eval
```

## Deploy (Render, free tier)

[render.yaml](render.yaml) deploys both services.

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. It creates `clearslip-backend` (Node web service) and `clearslip-frontend` (static site).
3. Set the variables Render asks for:
   - backend `FRONTEND_URL` = the frontend's URL (e.g. `https://clearslip-frontend.onrender.com`) — required for CORS
   - frontend `VITE_API_URL` = the backend's URL (e.g. `https://clearslip-backend.onrender.com`)
   - backend `GROQ_API_KEY`, `N8N_WEBHOOK_URL`, `N8N_SECRET` — optional
4. After setting `VITE_API_URL`, redeploy the frontend (Vite bakes it in at build time).
5. Check `https://<backend>/api/health` returns `"status":"ok"`.

Free-tier notes: the backend sleeps after ~15 minutes idle and takes up to a minute to wake (the frontend waits up to 90 s, and pings the backend on page load). The first image decode after a deploy also downloads Tesseract's ~10 MB English data, and the first Ask ClearSlip question downloads the ~35 MB embedding model.

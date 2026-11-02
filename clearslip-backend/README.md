# ClearSlip Backend

Node.js + Express API server that decodes payslips with free, self-hosted OCR (Tesseract.js / pdf-parse) and a deterministic rules engine, with an optional free-tier LLM fallback (Groq) for payslips the rules can't read. Also forwards checklist requests to n8n.

## Folder structure

```
clearslip-backend/
├── server.js                    ← entry point (starts the server)
├── src/
│   ├── app.js                   ← Express app (imported by server.js and tests)
│   ├── config/index.js          ← env var loader
│   ├── routes/
│   │   ├── decode.js            ← POST /api/decode
│   │   ├── checklist.js         ← POST /api/checklist
│   │   └── health.js            ← GET  /api/health
│   ├── controllers/
│   │   ├── decodeController.js
│   │   └── checklistController.js
│   ├── services/
│   │   ├── ocrService.js        ← image OCR (Tesseract.js) + PDF text (pdf-parse)
│   │   ├── rulesEngine.js       ← deterministic parser, tax + CTC calculations
│   │   ├── llmFallbackService.js← Groq fallback for low-confidence payslips
│   │   └── n8nService.js        ← n8n webhook forwarder
│   ├── middleware/
│   │   ├── cors.js
│   │   ├── rateLimiter.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   └── validateInput.js     ← Zod request schemas
│   └── prompts/
│       └── fallbackPrompt.js    ← fallback LLM system prompt
├── tests/                       ← Jest + Supertest (npm test)
└── .env.example
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your .env file
```bash
cp .env.example .env
```
All variables are optional — the server starts with none of them set.
- `GROQ_API_KEY` — free at console.groq.com; enables the LLM fallback for payslips the rules engine can't read (without it, those return a 422 error)
- `N8N_WEBHOOK_URL` — from your n8n webhook node; enables the "Email checklist" feature (without it, that returns a 503 error)

### 3. Start the dev server
```bash
npm run dev
```
Server starts at **http://localhost:4000**

### 4. Test it's working
```bash
curl http://localhost:4000/api/health
```
Should return `{"status":"ok",...}`

### 5. Run the tests
```bash
npm test
```
166 tests: parser, tax calculator, six real-world payslip samples (as text and as OCR output) and API endpoints. They never call Groq or n8n, even if your `.env` has real keys.

---

## API Endpoints

### POST /api/decode
Decodes a payslip. Image/PDF blocks are OCR'd first; the text is then parsed by the rules engine, falling back to the LLM if fewer than 2 components are recognised. `data.engine` is `"rules"` or `"llm-fallback"`.

Note: the first image request downloads Tesseract's English language data (~10 MB), so it is slower than later ones.

**Request body:**
```json
{
  "messages": [
    { "type": "text", "text": "Basic: 25000, HRA: 12500, PF: 3000, TDS: 4200" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": { "takeHome": 52400, "ctc": 800000, "tds": 50400, "savingsPotential": 46800 },
    "breakdown": [...],
    "actionItems": [...],
    "disclaimer": "...",
    "engine": "rules"
  }
}
```

---

### POST /api/ask
Answers a question with retrieval-augmented generation (see the project documentation, §12).

**Request body:** `{ "question": "Which regime is better for me?", "payslip": { "summary": {…}, "breakdown": […] }, "history": [{ "role": "user", "content": "…" }] }` — `payslip` and `history` are optional.

**Response `data`:** `mode` (`rag` | `retrieval-only` | `no-sources`), `answer` (with `[n]` citations), `sources` (`n`, `title`, `section`, `reference`, `source`, `text`), `cited` (numbers used), `toolCalls` (`name`, `args`, `result`), `retrievalMethod` (`hybrid` | `bm25`).

---

### POST /api/checklist
Forwards checklist to n8n for email delivery.

**Request body:**
```json
{
  "email": "user@example.com",
  "checklistItems": [{ "action": "Submit rent receipts to HR", "priority": "high" }],
  "payslipSummary": { "takeHome": 52400 }
}
```

---

### GET /api/health
Returns server status and uptime.

---

## Deployment (free)

### Railway (recommended for students)
```bash
npm install -g railway
railway login
railway init
railway up
```
Add env vars in Railway dashboard → Variables tab.

### Render
- Connect GitHub repo at render.com
- Build command: `npm install`
- Start command: `node server.js`
- Add env vars in Render dashboard

---

## Frontend .env update
After deploying the backend, update your frontend `.env`:
```
VITE_API_URL=https://your-backend.railway.app
```

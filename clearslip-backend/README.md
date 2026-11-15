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
322 tests: parser (including messy payslips: bonus months, unknown lines, totals that disagree), tax calculator, what-if simulator, AI answer checks (planted figures, outages, timeouts), security and privacy checks, six real-world payslip samples (as text and as OCR output) and API endpoints. They never call Groq or n8n, even if your `.env` has real keys.

### 6. Check a deployed copy
```bash
npm run smoke -- https://clearslip-backend.onrender.com https://clearslip-frontend.onrender.com
```
Runs 13 checks from outside: health, decoding, the calculator, Ask ClearSlip, body limits, CORS between the two services, security headers, whether the site was built with the right `VITE_API_URL` (in the bundle and in its Content-Security-Policy), and that the OCR files are served by the site itself. No AI calls. See [DEPLOY.md](../DEPLOY.md).

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
    "summary": { "takeHome": 52400, "ctc": 800000, "tds": 50400, "estimatedTax": 0, "savingsPotential": 0 },
    "breakdown": [...],
    "actionItems": [...],
    "disclaimer": "...",
    "engine": "rules"
  }
}
```

`estimatedTax` is the yearly tax on the salary under the cheaper regime, with PF and professional tax as the only deductions. `savingsPotential` is how much using the full 80C and NPS limits would lower it. It is often ₹0, because deductions don't reduce new-regime tax. When payslip TDS is more than ₹6,000 a year above `estimatedTax`, the first action item says the user may be overpaying.

Each `breakdown` row from the rules engine also has `source` (the payslip line it was read from) and, when the ₹ sign was repaired, `corrected: true`. `checks` lists "please check" notes (minus signs, figures that look yearly, repaired amounts). A text block may carry `origin`: `"typed"` (default), `"pdf"` (a PDF's text layer read in the browser) or `"ocr"` (read with OCR in the browser, so the ₹ repair applies).

---

### POST /api/decode/recalculate
Recalculates a decode from figures the user checked or corrected. No OCR or AI.

**Request body:** `{ "breakdown": [{ "component": "Basic Salary", "type": "earning", "monthly": 37500 }, { "component": "Employee PF", "type": "deduction", "monthly": 1800 }] }` (1–30 rows)

**Response `data`:** the same shape as `/api/decode`, with `engine: "edited"` and `edited: true` on each row. `422 IMPOSSIBLE_FIGURES` if take-home comes to zero or less.

---

### POST /api/ask
Answers a question with retrieval-augmented generation (see the project documentation, §12).

**Request body:** `{ "question": "Which regime is better for me?", "payslip": { "summary": {…}, "breakdown": […] }, "history": [{ "role": "user", "content": "…" }] }` — `payslip` and `history` are optional.

**Response `data`:** `mode` (`rag` | `retrieval-only` | `no-sources` | `clarify` — a vague question with a payslip attached, answered with `suggestions`), `notice` (why AI was unavailable, in `retrieval-only` mode — rate limit, expired key, retired model), `answer` (with `[n]` citations), `sources` (`n`, `title`, `section`, `reference`, `source`, `text`), `cited` (numbers used), `toolCalls` (`name`, `args`, `result`), `retrievalMethod` (`hybrid` | `bm25`).

In `rag` mode the answer also comes as `parts`: `[{ kind, text }]` with `kind` one of `payslip` (figures from the user's payslip), `explanation` (rules, cited), `calculation` (a calculator result) or `missing` (what the sources don't cover). It is `null` if the model didn't label its answer. `checks` reports what the server verified in code: `untracedAmounts` (₹ figures that match nothing in the payslip, a calculator result or a source), `invalidCitations` (removed from the answer), `noCitations`, and `calculationWithoutTool`.

### POST /api/ask/stream
The same request, answered as Server-Sent Events: `text` (`{ text }`, a piece of the answer as it is written), `reset` (discard the text so far — the model turned to a calculator), `done` (`{ data }`, exactly what `/api/ask` returns), or `error` (`{ error, code }`). Validation errors (empty question, PAN/Aadhaar) are plain JSON responses before the stream starts.

---

### POST /api/tax/simulate
The what-if simulator: both regimes' tax for a salary plus the deductions the user is trying out. No AI; rate limit 240 a minute.

**Request body** (annual rupees except `rentPaidMonthly`; only `grossAnnual` is required): `{ "grossAnnual": 900000, "basicAnnual": 450000, "daAnnual": 0, "hraReceivedAnnual": 180000, "employeePfAnnual": 54000, "professionalTaxAnnual": 2400, "extra80C": 50000, "nps80CCD1B": 0, "health80D": 25000, "rentPaidMonthly": 20000, "metro": false, "homeLoanInterest": 0 }`

**Response `data`:** `newRegime` and `oldRegime` (taxable income, slab tax, rebate, marginal relief, cess, `totalTax`, `monthlyTax`, `deductions`), `better` (`new` | `old` | `same`), `annualSaving`, `hra` (exemption and its three limits, or `null`), `section80C` (`fromPf`, `extra`, `cap`), `breakEven` (`currentDeductions`, `deductionsNeeded`, `shortfall`).

---

### POST /api/checklist
Forwards a checklist to n8n for email delivery. Only checklists ClearSlip itself produced are accepted: send back the `actionItems`, `summary` and `checklistToken` exactly as `/api/decode` returned them. Changed text gets `403 CHECKLIST_NOT_VERIFIED`, and links must be https on an official site (`.gov.in`, `.nic.in`, NSDL).

**Request body:**
```json
{
  "email": "user@example.com",
  "checklistItems": [{ "priority": "high", "action": "Submit your rent receipts / rent agreement to HR…", "link": null }],
  "payslipSummary": { "takeHome": 30300, "ctc": 486000, "tds": 50400, "estimatedTax": 0, "savingsPotential": 0 },
  "checklistToken": "<64 hex characters from the decode response>"
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

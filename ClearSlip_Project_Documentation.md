# ClearSlip — Final-Year Project Documentation

**Project:** ClearSlip — AI-assisted Indian Payslip Decoder
**Document purpose:** Full record of what has been built, what is planned for the 5-day sprint, what has been deferred, the formulas/logic behind the engine, known limitations, and the system prompts in use — for your project report, viva prep, and progress tracking.

---

## 1. Project Overview

ClearSlip helps first-time salaried employees in India understand their payslip: it extracts the salary components (Basic, HRA, PF, TDS, etc.) from an uploaded payslip image/PDF or pasted text, explains each component in plain language, computes take-home pay / CTC / tax / potential savings, and generates concrete action items (e.g. "submit rent receipts for HRA exemption").

**Original architecture:** single call to the Claude API (vision + reasoning combined).
**Current architecture (post-migration):** free, self-hosted OCR + a deterministic rules engine, with an optional free-tier LLM fallback for edge cases. No paid AI API required for the core flow.

---

## 2. Current Architecture

```
Frontend (React/Vite)
        │
        │  POST /api/decode  { messages: [ text | image ] }
        ▼
Backend (Express)
        │
        ▼
 imageBlock present? ──yes──► ocrService.js
        │                      (Tesseract.js for images,
        │no                     pdf-parse for text-layer PDFs)
        ▼                             │
   raw text  ◄──────────────────────────┘
        │
        ▼
 rulesEngine.js (deterministic, no AI)
        │
   confidence ≥ 2 components? ──yes──► return result (engine: "rules")
        │
        no
        ▼
 llmFallbackService.js (Groq free tier, optional)
        │
        ▼
   return result (engine: "llm-fallback")
```

Response contract is unchanged from the original Claude-based version, so the frontend required no modification.

---

## 3. Features Already Implemented (Phase 0 — completed)

| Feature | File(s) | Status |
|---|---|---|
| Free OCR from images | `src/services/ocrService.js` | ✅ Done — Tesseract.js |
| Text extraction from digital PDFs | `src/services/ocrService.js` | ✅ Done — pdf-parse |
| Deterministic payslip parser (no AI) | `src/services/rulesEngine.js` | ✅ Done |
| Tax/CTC/savings calculation | `src/services/rulesEngine.js` | ✅ Done |
| Rule-based action item generation | `src/services/rulesEngine.js` | ✅ Done |
| Confidence scoring + fallback trigger | `src/services/rulesEngine.js`, `decodeController.js` | ✅ Done |
| Free LLM fallback (Groq) for low-confidence cases | `src/services/llmFallbackService.js`, `src/prompts/fallbackPrompt.js` | ✅ Done |
| Request validation (Zod schemas) | `src/utils/validateInput.js` | ✅ Done — unchanged from original |
| Rate limiting, CORS, error handling | `src/middleware/*` | ✅ Done — unchanged from original |
| n8n checklist email forwarding | `src/services/n8nService.js` | ✅ Done — unchanged from original |
| Removed Claude/Anthropic dependency | `package.json`, `config/index.js` | ✅ Done |
| Unit-verified parsing logic | manual test runs | ✅ Verified — see §4 for the two bugs found and fixed during testing |
| Decode pipeline wired end to end (OCR → rules → fallback) | `src/controllers/decodeController.js` | ✅ Done — response includes `engine: "rules" \| "llm-fallback"` |
| Tax slabs updated to Budget 2025 (FY 2025-26) + 4% cess + 87A marginal relief | `src/services/rulesEngine.js`, `src/prompts/fallbackPrompt.js` | ✅ Done |
| Parser handles real layouts: two-column lines, YTD columns, `k`/`L`/`Cr` units, PF No/UAN/employer lines ignored | `src/services/rulesEngine.js` | ✅ Done — see §4.1–4.2 |
| Jest + Supertest test suite (187 tests) | `tests/` | ✅ Done — see §9 |
| Tested against 6 real-world payslip formats from Indian HR websites (text + OCR) | `tests/webSamples.test.js` | ✅ Done — 6/6, see §9.1 |
| Demo-readiness: dead "Sign in"/"Get started" buttons removed; unfinished Govt Docs tab hidden (`SHOW_GOVT_DOCS` in `App.jsx`) | `Navbar.jsx`, `App.jsx` | ✅ Done |
| UI adapts to the server's optional features (`GET /api/health` → `features`): Describe mode explains it needs AI, AI-only examples hidden, email button hidden when n8n is off; plain-language error instead of setup instructions | `useServerFeatures.js`, `InputPanel.jsx`, `ActionCard.jsx`, `llmFallbackService.js` | ✅ Done |
| Phone layout fixed: inline styles were overriding Tailwind's responsive classes, so panels never stacked and desktop nav links showed on phones | `Home.jsx`, `Navbar.jsx` | ✅ Done — checked at 375 px and 1280 px |
| Git repository + deployment config (`render.yaml`, root `README.md`) | repo root | ✅ Done — deploy itself still to do (§10) |
| UI redesign for laptop/desktop screens: rem-based type scale (body 16 px, figures 30 px — was 94% of text at 12–13 px), centred layout up to 1536 px with a sticky input card, side-by-side results on wide screens, welcome screen with "Try a sample payslip", explanations shown under each component, lucide icons, WCAG-AA text colours, inline styles replaced by Tailwind tokens | `tailwind.config.js`, all components | ✅ Done — checked at 375, 1440 and 1920 px |
| **Ask ClearSlip (RAG):** hybrid retrieval over a 16-document tax knowledge base, cited answers, LLM tool calls to the tax calculators, relevance guard, retrieval evaluation (hybrid Hit@1 97.1%) | `src/rag/`, `askService.js`, `AskPanel.jsx` | ✅ Done — see §12 |
| Old-regime calculator, regime comparison and HRA exemption calculator | `src/services/taxCalculator.js` | ✅ Done — used by Ask ClearSlip |
| **What-if tax simulator:** sliders for 80C, NPS, 80D, rent/HRA and home-loan interest, both regimes updated live, break-even point, step-by-step calculation | `taxSimulator.js`, `POST /api/tax/simulate`, `WhatIfSimulator.jsx` | ✅ Done — see §13 |
| OCR ₹-misread correction using the payslip's own totals | `src/services/rulesEngine.js` | ✅ Done — see §9.1 |
| Labelled 12-digit UANs no longer rejected as Aadhaar numbers | `src/controllers/decodeController.js` | ✅ Done |
| Frontend build setup (Vite + Tailwind) | `package.json`, `index.html`, `vite.config.js`, `postcss.config.js` | ✅ Done |

**Bugs found and fixed during implementation** (worth mentioning in your report as evidence of testing rigor):
1. **Number-splitting regex bug** — the original number regex split plain numbers without commas (e.g. `25000`) into two tokens (`250` + `00`), corrupting every amount. Fixed by requiring at least one comma group before matching the comma-grouped branch of the regex.
2. **Comma-tokenizing bug** — splitting input text on every comma broke comma-formatted numbers (`12,500`) that appeared alone on a line. Fixed with a negative lookahead (`,(?!\d)`) so only list-separator commas (not thousands separators) are split on.

---

## 4. Formulas & Calculations Used (Rules Engine)

### 4.1 Component recognition
Each payslip line/segment is scanned for **every** known component label (Basic, DA, HRA, Special Allowance, LTA, Conveyance, Medical Allowance, Bonus, Other Allowance, PF, TDS, ESI/ESIC, Professional Tax / P.Tax / PT, NPS, Loan Recovery, Gross / Total Earnings, Total Deductions, Net Pay, CTC) via regex. A line can hold several label/amount pairs — two-column payslips OCR as `Basic 30,000 Provident Fund 3,600` — so the amounts between one label and the next belong to the first label. Overlapping matches go to the earliest, then longest, label.

Some labels are recognised only so their numbers are **ignored**: identifiers (`PF No`, `UAN`, `Emp ID`) and employer-side amounts (`Employer PF`, `Employer contribution`). `Gross Deductions` is a deductions total, not gross salary. The first occurrence of each component in the document wins.

### 4.2 Number extraction
```
AMOUNT_RE = /(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(lakhs?|lacs?|lpa|crores?|cr|l|k))?/gi
```
Matches comma-grouped (Indian `1,00,000` / international `100,000`) and plain numbers, with an optional unit suffix: `k` = ×1,000; `L` / `lakh` / `LPA` = ×1,00,000 (annual); `Cr` = ×1,00,00,000 (annual). Units only apply to figures under 1,000 (`52k`, `1.2 Cr`) — on a full amount, a trailing `Cr` means *credit*. Percentages (`PF @ 12%`) are removed first.

Monthly vs annual, per label:
```
if amount has an annual unit, or the text says "per annum"/"p.a."/"annual",
   or (label is CTC and amount ≥ 2,00,000)     → annual = amount, monthly = amount ÷ 12
else monthly = first amount
     annual  = second amount   if it is within ±10% of monthly × 12
             = monthly × 12    otherwise (second amount is a YTD/arrears column)
```

### 4.3 Gross salary
```
grossMonthly = found.gross ? found.gross.monthly
             : Σ (monthly value of every recognized earning component)
```

### 4.4 Take-home pay
```
deductionsMonthly = found.totalDeductions ? found.totalDeductions.monthly
                  : Σ (monthly value of every recognized deduction)
takeHomeMonthly   = found.netPay ? found.netPay.monthly
                  : grossMonthly − deductionsMonthly
```
A take-home of ₹0 or less means the numbers were mis-read, so the result is discarded (see §4.9).

### 4.5 Employer contributions (not shown on payslip, but part of CTC)
```
employerPF  = basicMonthly × 0.12   (if PF deduction present)
employerNPS = basicMonthly × 0.10   (if NPS deduction present)
```

### 4.6 CTC (Cost to Company)
```
ctcMonthly = found.ctc ? found.ctc.monthly
           : grossMonthly + employerPF + employerNPS
ctcAnnual  = ctcMonthly × 12
```

### 4.7 Income tax estimate — New Regime, FY 2025-26 (Budget 2025)
```
taxableIncome = max(0, annualGross − 75,000)   // standard deduction

if taxableIncome ≤ 12,00,000 → tax = 0   // Section 87A full rebate

Slab            Rate
₹0 – 4L         0%
₹4L – 8L        5%
₹8L – 12L       10%
₹12L – 16L      15%
₹16L – 20L      20%
₹20L – 24L      25%
Above ₹24L      30%

slabTax = Σ over each slab: (min(taxableIncome, slabUpperBound) − slabLowerBound) × slabRate
tax     = min(slabTax, taxableIncome − 12,00,000)   // marginal relief just above the rebate limit
tax     = tax × 1.04                                // 4% health & education cess
```
Used only when TDS is not explicitly found on the payslip; otherwise the payslip's own stated TDS × 12 is used directly.

Worked examples: ₹10L gross → ₹0; ₹13L gross → ₹26,000 (marginal relief); ₹16.75L gross → ₹1,24,800.

### 4.8 Savings potential (rough estimate)
```
employeePfAnnual   = found.pf ? found.pf.annual : 0
remaining80C       = max(0, 150,000 − employeePfAnnual)     // Section 80C headroom
npsExtraHeadroom   = found.nps ? 0 : 50,000                  // Section 80CCD(1B), old regime only
savingsPotential   = round((remaining80C × 0.05) + (npsExtraHeadroom × 0.05))
```
Estimated at the lowest applicable slab rate (5%) as a conservative floor — flagged in the disclaimer as an estimate, since true savings depend on the person's actual marginal tax rate.

### 4.9 Confidence score
```
confidence = (# recognized earning components)
           + (# recognized deduction components)
           + (1 if Gross found else 0)
           + (1 if Net Pay found else 0)

Route to LLM fallback (or return a clear error if no fallback is configured) when:
  confidence < 2
  OR no earning component and no Gross were found   // e.g. "CTC 8L, take-home 52k"
  OR takeHomeMonthly ≤ 0                            // numbers mis-read
```

---

## 5. Features Planned — 5-Day Sprint (Phase 1, in progress)

| Day | Feature | Why it matters for evaluation |
|---|---|---|
| 1 | JWT auth + user model + decode-history persistence (DB) | Turns the project from a stateless API demo into a real application |
| 2 | ~~Old vs New tax regime comparator~~ ✅ done as a calculator + Ask ClearSlip tool (§12) | Most-requested real-world feature; reuses existing engine |
| 2 | History/trend dashboard (Recharts: take-home & tax over time) | Demonstrates data visualization + persistence together |
| 3 | ~~Jest test suite for `rulesEngine.js` and the tax calculator~~ ✅ done (187 tests, incl. old regime & comparison) | Shows testing discipline — high grading value for low effort |
| 3 | ~~Bug fixing against edge cases (unusual formats)~~ ✅ two-column/YTD/units done — test with more real payslip photos | Real debugging, not just feature-adding |
| 4 | Deployment (Railway/Render, backend + frontend) | Required for a working demo/viva |
| 4 | UI polish pass | Presentation quality |
| 5 | Full code walkthrough + understanding pass (no new code) | Viva preparedness — non-negotiable, see prior discussion |
| 5 | Project report writing (architecture, testing approach, formulas, limitations) | This document is the source material for that report |

---

## 6. Features Deferred / Not Being Built in This Sprint

These were discussed as good ideas but are explicitly **out of scope** for the 5-day timeline, to protect Day 5 (understanding + report writing):

| Feature | Reason deferred |
|---|---|
| Offer comparison tool (compare two CTC breakdowns side by side) | Nice-to-have; reuses existing engine but adds UI + testing time not available |
| PDF export of the report | Polish item, not core functionality |
| Multi-language support (Hindi/regional, i18next) | High-value for real users but time-intensive to do properly (translation + testing) |
| Reminder system (node-cron + email) | Depends on n8n pipeline extension; scope creep risk |
| Admin analytics dashboard | Nice for a "data" narrative but not essential for a payslip-decoder demo |
| PWA support | Low priority; installability isn't core to the project's value proposition |
| Docker/Compose packaging | Useful for deployment story but not required if Railway/Render deployment works |
| Swagger/OpenAPI docs | Documentation nice-to-have; this document + README cover the same ground for report purposes |

**If ahead of schedule after Day 4**, the recommended order to pick these back up is: Offer comparator → PDF export (in that order, by effort-to-value ratio). The what-if simulator was built — see §13.

---

## 7. Known Limitations / What Cannot Be Executed

Be upfront about these in your report and viva — examiners respond well to honest scoping, not to a project that claims to do everything.

1. **Scanned/image-only PDFs are not OCR'd.** Rasterizing PDF pages to images for OCR requires native binaries (poppler/graphicsmagick) not reliably available on free hosting tiers (Railway/Render free tiers). The app currently asks the user to upload a JPG/PNG screenshot instead. *Possible future fix: use a service like `pdf-poppler` if deploying somewhere with system-level access, or a headless-Chromium-based renderer.*
2. **Non-standard payslip formats or regional-language payslips** may not be recognized by the rules engine's pattern matching, and will fall through to the LLM fallback (if configured) or return an error. This is an inherent limitation of regex-based parsing versus a full LLM-vision approach.
3. **Tax figures are estimates, not filings-grade calculations.** They don't account for every possible exemption (e.g. Section 24 home loan interest, Section 80D health insurance, capital gains) — only the common salaried-employee deductions (80C, 80CCD). This is disclosed to the user via the `disclaimer` field in every response.
4. **No real-time integration with government systems** (Income Tax e-filing portal, EPFO, PAN verification) — there is no public free API for these, and building against them would require registered-entity API access not available for a student project.
5. **OCR accuracy depends on image quality.** Blurry photos, low contrast, or handwritten payslips will produce poor extraction — this is a Tesseract.js limitation, not something fixable at the application layer without a paid/more powerful OCR service. The ₹ sign is often misread as a leading 2/3; this is corrected using the slip's own totals (§9.1), but only when the slip prints a Gross and/or Total Deductions line. The website samples were tested as clean rendered images, not phone photos, so photo-quality accuracy is still unmeasured.
6. **The LLM fallback is optional and rate-limited** by Groq's free tier — under heavy simultaneous use (e.g. a live class demo with many users), it could throttle. Worth mentioning as a "future scaling consideration" in your report rather than hiding it.

---

## 8. System Prompts In Use

### 8.1 Fallback LLM system prompt (`src/prompts/fallbackPrompt.js`)

This prompt is sent to the Groq LLM only when the rules engine's confidence score is below 2. It is text-only (OCR has already run by this point), unlike the original Claude prompt which handled vision + reasoning together.

```
You are ClearSlip, an Indian payslip and tax expert who speaks like a
helpful elder sibling who genuinely knows the rules. You are warm,
plain-spoken, and always give concrete next steps.

You will be given raw text extracted (via OCR or direct user input)
from a payslip. The formatting may be messy — ignore OCR noise and
focus on the numbers and labels you can confidently identify.

SALARY KNOWLEDGE:
- Basic Salary: typically 40-50% of CTC
- HRA: typically 40-50% of Basic (50% metro, 40% non-metro). Tax-exempt if rent paid.
- Special Allowance: flexible component, fully taxable
- LTA: tax-exempt for actual travel twice in 4 years
- PF: Employee 12% of Basic + Employer 12% of Basic (employer share not
  shown as deduction). Max ₹1,50,000/yr under 80C.
- TDS: deducted based on projected annual income after declared investments
- ESI: 0.75% of gross if monthly gross < ₹21,000
- Professional Tax: state-specific (Maharashtra ₹200/mo, Karnataka ₹200/mo, etc.)
- NPS: Optional. Employee 10% Basic + Employer 10% Basic. Extra ₹50,000
  under 80CCD(1B).
- 80C limit: ₹1,50,000/year total (PF + ELSS + PPF + LIC combined)

TAX SLABS — New Regime FY2025-26 (default):
- Up to ₹4L: Nil | ₹4-8L: 5% | ₹8-12L: 10% | ₹12-16L: 15% | ₹16-20L: 20%
  | ₹20-24L: 25% | Above ₹24L: 30%
- Rebate u/s 87A: Taxable income up to ₹12L = zero tax under new regime
  (marginal relief just above ₹12L)
- Standard deduction: ₹75,000
- Add 4% health & education cess on the tax

TAX SLABS — Old Regime (mention only if user asks):
- Up to ₹2.5L: Nil | ₹2.5-5L: 5% | ₹5-10L: 20% | Above ₹10L: 30%
- Standard deduction ₹50,000. 80C ₹1,50,000. HRA, LTA, NPS apply.

TONE RULES:
- Write at Class 10 reading level
- Never use jargon without immediately explaining it in brackets
- Always end with concrete next steps — never just explain, always say
  what to DO
- Be encouraging — first salary anxiety is real

PRIVACY RULES:
- Never ask for Aadhaar, PAN, bank account, or any credential
- If the text contains sensitive identifiers, ignore them and don't
  repeat them back

HONESTY RULES:
- If unsure about a state-specific rule, say so
- Never fabricate amounts or government rules
- If the input is too vague or garbled to make sense of, make the most
  reasonable assumption and clearly flag it in the disclaimer

OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no preamble:
{
  "summary": {
    "takeHome": <number monthly>,
    "ctc": <number annual, 0 if unknown>,
    "tds": <number annual>,
    "savingsPotential": <number additional annual savings possible>
  },
  "breakdown": [
    {
      "component": <string>,
      "type": <"earning" | "deduction">,
      "monthly": <number>,
      "annual": <number>,
      "explanation": <one plain-English sentence>
    }
  ],
  "actionItems": [
    {
      "priority": <"high" | "medium" | "low">,
      "action": <specific actionable step with deadline if relevant>,
      "link": <official URL or null>
    }
  ],
  "disclaimer": <string — brief note about assumptions made>
}

Order: all earnings first, then all deductions. actionItems ordered
high → medium → low. Minimum 2, maximum 5 actionItems.
```

### 8.2 Note on the original Claude prompt
The original `payslipDecoder.js` prompt (used with Claude's vision API) has been removed from the codebase, since the new architecture no longer calls Claude. Its salary/tax knowledge was preserved and ported into both the rules engine (§4) and the fallback prompt above, so no domain knowledge was lost in the migration.

---

## 9. Testing (done — 187 automated tests, all passing)

Run with `npm test` in `clearslip-backend` (Jest + Supertest).

- **`tests/rulesEngine.test.js` (34 tests)** — number parsing (plain, comma-grouped, Indian lakh format, `k`/`L`/`LPA`/`Cr` units, "Cr" as credit, percentages, OCR-misread ₹ signs); component recognition (two-column OCR lines, YTD columns ignored, real annual columns accepted, "per annum", short labels DA/P.Tax/ESIC); false positives (`Gross Deductions`, `Total Deductions`, `PF No`/`UAN`, `Employer PF`, numbers before any label); OCR ₹-misread correction; confidence/fallback routing; action items.
- **`tests/taxCalculator.test.js` (12 tests)** — 87A rebate up to ₹12L taxable, marginal relief just above it, every slab boundary (₹16L, ₹20L, ₹24L) and a property check that tax never exceeds income above the rebate limit.
- **`tests/webSamples.test.js` (38 tests)** — six sample payslips published on Indian payroll/HR websites (taggd, Kredily, Hirist ×2, sum.money, indianpaycalculator — corporate and central-government formats), each checked **twice**: as pasted text, and as the text Tesseract actually read from an image of it. Fixtures: `tests/fixtures/webSamples.js` (with source URLs) and `tests/fixtures/ocr/`.
- **`tests/api.test.js` (15 tests)** — `GET /api/health` feature flags; `POST /api/decode` with text, a text-layer PDF, a scanned PDF, a corrupt PDF, unreadable text with and without the LLM fallback (Groq mocked), Aadhaar rejection, UAN allowed, malformed requests; `POST /api/checklist` without n8n and with a bad email; `GET /api/health`.
- **Not automated:** running Tesseract itself (it downloads ~10 MB of language data on first run). Instead, the real OCR output of each web sample is saved as a fixture, and the full image → API path was verified manually.

### 9.1 Testing against real-world payslip formats
Before this round the parser decoded **2 of 6** website samples as text, and **3 of 6** after OCR. After the fixes below: **6/6 in both**.

| Problem found | Example from the samples | Fix |
|---|---|---|
| Comma inside brackets split the line | `Employee State Insurance (ESI, if applicable): 375` | Commas inside brackets are not split points |
| Employer amount counted as employee PF | `Employer Share of PF  6,000` | Employer share/contribution lines are ignored |
| Label and amount on separate lines | `BASIC PAY` / `₹56,100` (government slips) | A label with no amount takes the last amount on the next label-free line |
| Explanatory sub-lines mention other labels | `63% of Basic Pay — effective July 2026  ₹29,988` | A label right after "of" is a reference, not a line item |
| Bracketed notes carry numbers and labels | `NPS (10% OF BASIC+DA)`, `TRANSPORT ALLOWANCE (₹7,200 + 60% DA)` | Brackets containing %, + or digits-with-words are removed |
| Missing component | Transport Allowance (central government) | Added |
| **OCR reads the ₹ sign as a digit** | `₹9,520` → `39,520`, `₹16,830` → `316,830` | See below |

**OCR ₹-misread correction.** Tesseract's English model has no ₹ glyph, so it outputs `%`, `¥`, `]` (harmless) or a leading **2**/**3** (which silently changes the amount). Tesseract's per-character confidence does not separate these from real digits (82–94% for both), so the parser checks the payslip's own arithmetic instead. For OCR'd images only, an amount that starts with 2/3 and is still well-formed without that digit gets an alternative reading (`30,000` and `2,500` never do). The parser then picks the combination of readings where:
```
Σ listed earnings   ≤ Gross
Σ listed deductions ≤ Total Deductions
Net Pay = Gross − Total Deductions     (dropped if the slip's totals never agree)
Net Pay ≤ Gross
```
choosing the one that leaves the smallest unexplained amount, then the fewest changes. Without a Gross or Total line on the slip there is nothing to check against, so such amounts are left as read.

**Bugs caught by the tests and fixed:** corrupt PDFs returned 500 instead of 400; pdf-parse mis-read Node Buffers under Jest (now passed a `Uint8Array`); `%6,00,000` (₹ read as %) was swallowed as a percentage.

**Bugs fixed during the parser rewrite:** two-column lines lost every deduction; YTD columns were read as annual figures; "Gross Deductions" was read as gross salary (take-home showed ₹400); "8L"/"52k" were not understood; `PF No` digits were read as a PF deduction.

---

## 10. Deployment (ready — needs your Render account)

- **One-click setup:** `render.yaml` (Render Blueprint) creates the backend (Node web service, health check `/api/health`) and the frontend (static site) together on the free tier. Step-by-step instructions are in the root `README.md`.
- **Variables:** backend `FRONTEND_URL` (required, for CORS), `GROQ_API_KEY` / `N8N_WEBHOOK_URL` / `N8N_SECRET` (optional); frontend `VITE_API_URL` (baked in at build time, so redeploy after setting it).
- **Production fixes already made:** Express trusts the host's proxy in production, so rate limits apply per user rather than to everyone behind Render's proxy; the frontend waits up to 90 s for a reply, covering a free-tier cold start (~1 min) plus the first-run OCR language download (~10 MB, written to the app folder, which is writable on Render).
- **Not yet done:** the actual deploy (needs a GitHub repo and a Render account) and a check of the live URLs.

---

## 12. Ask ClearSlip — Retrieval-Augmented Generation (RAG)

### 12.1 What it does
Users ask questions in plain language — "Which regime is better for me?", "Can I claim rent paid to my mother?" — on the **Ask ClearSlip** page or under their decoded payslip. Answers come only from a knowledge base of Indian salary-tax rules, cite the exact passage they rely on, and get every number from ClearSlip's tested tax calculators rather than from the language model.

### 12.2 Architecture
```
question (+ decoded payslip, + last turns)
        │
        ▼
 retrieve top 5 passages ── BM25 (keywords + synonyms) ─┐
        │                └─ dense embeddings (bge-small) ┴─► Reciprocal Rank Fusion
        ▼
 relevant? ──no──► "I couldn't find this in my sources" (no LLM call)
        │yes
        ▼
 GROQ_API_KEY set? ──no──► return the passages with sources ("sources only" mode)
        │yes
        ▼
 gpt-oss-120b (Groq) with numbered SOURCES + payslip + 3 tools
        │   ├─ compare_tax_regimes ─┐
        │   ├─ calculate_tax        ├─► src/services/taxCalculator.js (deterministic, unit-tested)
        │   └─ calculate_hra_exemption ┘
        ▼
 answer with [n] citations → cited sources + tool results shown in the UI
```

| Part | File |
|---|---|
| Knowledge base — 16 documents, 75 sections, ~3,900 words | `src/rag/corpus/*.md` |
| Chunking (one chunk per section) + corpus hash | `src/rag/corpus.js` |
| BM25 keyword search with payslip synonyms | `src/rag/bm25.js` |
| Local embeddings (`Xenova/bge-small-en-v1.5`, 384-d, free) | `src/rag/embeddings.js` |
| Hybrid retrieval, RRF fusion, relevance guard | `src/rag/knowledgeBase.js` |
| Precomputed embeddings (`npm run rag:index`) | `src/rag/index.json`, `scripts/buildRagIndex.js` |
| Tools exposed to the model | `src/rag/tools.js` |
| Tax calculators (new/old regime, comparison, HRA) | `src/services/taxCalculator.js` |
| Grounded system prompt | `src/prompts/askPrompt.js` |
| Orchestration: retrieve → guard → LLM + tool loop → citations | `src/services/askService.js` |
| API | `POST /api/ask` (`src/routes/ask.js`) |
| UI | `AskPanel.jsx`, `AnswerText.jsx`, `pages/Ask.jsx` |

### 12.3 Design decisions (viva notes)
- **Why hybrid retrieval?** BM25 is exact on section numbers and terms ("80CCD(1B)", "Form 16"); embeddings match meaning when the words differ ("Why is 12% of my basic cut every month?" → EPF). Reciprocal Rank Fusion (score = Σ 1/(60 + rank)) combines them without having to calibrate their very different score scales.
- **Why one chunk per section?** Each section is short and self-contained, so a citation points at exactly the passage that supports the sentence.
- **Why tools for numbers?** LLMs make arithmetic mistakes. The model only decides *which* calculation to run and with which inputs; the tested calculator produces the number, and the UI shows the tool's result next to the answer so it can be checked.
- **Guardrails:** refuse when retrieval finds nothing relevant (no LLM call); the prompt allows only cited sources and tool results; PAN/Aadhaar in a question is rejected; a malformed tool call is retried once, then answered without tools; at most 3 tool rounds.
- **Where are the vectors stored? (no separate vector database)** The 75 passage embeddings (384 numbers each, ~240 KB) are precomputed into `src/rag/index.json` and loaded into memory at start-up; a query is compared with all 75 by dot product (exact nearest-neighbour search) in well under a millisecond. A vector database such as FAISS, Chroma, pgvector or Pinecone adds approximate indexes (HNSW, IVF) that pay off from roughly 100,000 vectors; at 75 they would add a service to run and deploy without making retrieval faster or more accurate. `KnowledgeBase.retrieve()` is the single place to swap one in if the corpus grows.
- **Deterministic routing for "which regime?":** with a payslip attached, the first model turn is required to call `compare_tax_regimes` (`tool_choice`), because in live testing the model sometimes asked for rent instead of comparing with the figures it already had.
- **Numbers the model can copy, not convert:** every tool result carries a `display` sentence with amounts in Indian format and the calculation steps (e.g. "slab tax ₹63,750, minus marginal relief ₹38,750, plus 4% cess ₹1,000 = ₹26,000"); in live testing the model had turned 26000 into "₹2.6 lakh" and called the marginal-relief amount the tax.
- **Degrades instead of failing:** if Groq rate-limits the request (free tier: 8,000 tokens a minute), the key is invalid or expired, or the model is retired, the answer falls back to "sources only" with a notice saying why; the payslip decoder's LLM fallback likewise falls back to the "paste your payslip lines" message.
- **Works without an API key:** in "sources only" mode the same retrieval returns the matching passages, so the feature can be demonstrated offline.
- **Free to run:** embeddings are computed locally with transformers.js; generation uses Groq's free tier.

### 12.4 Evaluation (`npm run rag:eval`)
37 questions written the way a first-time employee asks them, each labelled with the document that answers it (`tests/fixtures/ragEval.js`), plus 4 off-topic questions.

| Retrieval method | Hit@1 | Hit@3 | MRR |
|---|---|---|---|
| BM25 only | 94.6% | 100.0% | 0.964 |
| Dense (embeddings) only | 91.9% | 97.3% | 0.951 |
| **Hybrid (BM25 + dense, RRF)** | **97.3%** | 97.3% | **0.980** |

- **Relevance guard:** 4/4 off-topic questions refused, 37/37 on-topic questions answered. Thresholds were set from this data (off-topic questions top out at BM25 ≈ 4.0 / cosine ≈ 0.49; on-topic start at ≈ 6.0 / 0.60), with the cut-off between them (BM25 5, cosine 0.55).
- **Automated tests:** `tests/rag.test.js` (chunking, tokenizer, every evaluation question in BM25's top 3, guard, RRF, citations, the API in all three modes, and the full tool-calling loop with Groq mocked) and `tests/regimes.test.js` (calculators, hand-worked values). The rate-limit / expired-key fallbacks, forced regime comparison, tool-call retry and citation clean-up are tested with Groq mocked. The what-if simulator has its own tests (§13.3). Total suite: 187 tests.
- **Honest caveats:** the questions were written alongside the knowledge base, so these scores are likely optimistic — adding questions from real users would make the evaluation stronger. The live answer check below is a small manual review (6 questions), not a large-scale faithfulness benchmark.

#### Live answer check (Groq `openai/gpt-oss-120b`, 2 Nov 2026)
Six questions were asked against the running server with the sample payslip (₹75,000/month gross), and every number and claim was checked by hand against the calculator and the cited passage. The first run exposed four problems, each fixed and re-tested:

| Problem found in the first live run | Fix |
|---|---|
| HRA answer said "50% (metro)" for Bengaluru although the calculator had correctly used 40% (non-metro) | Tool result labels each limit with the rule applied; prompt: report tool labels exactly |
| EPF answer listed withdrawal rules that are not in the knowledge base | Prompt: answer only the parts the sources cover; added "Withdrawing PF" and "Tax on PF withdrawals" passages |
| "Which regime is better?" asked for rent instead of comparing | Forced `compare_tax_regimes` call when a payslip is attached |
| ₹26,000 reported as "₹2.6 lakh"; some answers had no citations; gpt-oss's native 【n】 citation style | `display` sentences in tool results; reasoning effort medium; 【n】 normalised to [n] |

| Question | Final result |
|---|---|
| Which tax regime is better for me? (with payslip) | ✅ Compared: new ₹0 vs old ₹74,069 (hand-checked: taxable ₹7,93,600 → ₹71,220 + 4% cess); cited [1][2][4][5] |
| ₹20,000 rent in Bengaluru — HRA exemption? | ✅ ₹1,80,000; limits ₹1,80,000 / ₹1,95,000 / ₹1,80,000 at 40% non-metro; cited [5] |
| Why is 12% of basic cut, can I withdraw it? | ✅ EPF explained, withdrawal answer limited to the passage, points to EPFO; cited [1][2] |
| Can I claim rent paid to my mother? | ✅ Matches the passage (parent owns the house, declares the income, PAN above ₹1 lakh); cited [1][2][3] |
| Tax on ₹13 lakh, new regime? | ✅ ₹26,000 (marginal relief); cited [5][3] |
| Biryani recipe (off-topic) | ✅ Refused by the relevance guard, no LLM call |

Token use is about 2,000 per model call (≈4,000 for a question that calls a tool), so the free tier answers roughly two questions a minute; beyond that users get the sources-only fallback.

### 12.5 Limitations
- The knowledge base is ClearSlip's own plain-language summary of the rules, each section citing its official source and legal reference — not the full text of the Act. It must be reviewed when rules change (e.g. each Budget), then re-indexed with `npm run rag:index` (a test fails if the index is stale).
- Calculators ignore surcharge (income above ₹50 lakh) and flag it; senior-citizen slabs are not modelled.
- State-specific professional-tax slabs are not covered in detail.
- The embedding model (~35 MB) downloads on the first question after a deploy; set `RAG_DENSE=off` to use BM25 only on very small servers.
- Groq's free tier allows about two AI answers a minute (8,000 tokens per minute); a paid tier or a smaller model (`GROQ_MODEL`) raises this. Groq retires models over time — Llama 3.3 70B, the original choice, was no longer available by November 2026 — so the model is configurable and an unavailable model degrades to sources-only answers.

## 13. What-if Tax Simulator

### 13.1 What it does
Under the decoded payslip, the user drags sliders for the deductions a salaried person can actually change — extra 80C investments, own NPS (80CCD(1B)), health insurance (80D), monthly rent (unlocks HRA exemption, with a metro toggle) and home-loan interest (24(b)) — and can edit the yearly salary to try a raise. Both regimes' tax updates as they drag, with:
- which regime is lower and by how much, per year and per month;
- the **break-even point**: the total old-regime deductions at which the old regime starts to win, and how far the current choices are from it;
- the HRA exemption with all three limits shown;
- a "How this is calculated" breakdown (gross → standard deduction → other deductions → taxable income → slab tax → rebate / marginal relief → cess → total).

### 13.2 How it works
- **Same calculator everywhere.** `POST /api/tax/simulate` (`taxController.js` → `taxSimulator.js`) runs the inputs through `taxCalculator.js` — the code the decoder's estimate and Ask ClearSlip's tool calls already use. One tested implementation of the tax rules, not a second copy in the browser.
- **Why on the server, not in the browser?** The frontend and backend deploy as separate services, each built from its own folder (`rootDir` in `render.yaml`), so importing the backend's file into the frontend would tie the two builds together, and copying it would leave two versions to keep in step. Each request is a few milliseconds of arithmetic with no AI, so the round-trip is the only cost.
- **Prefilled from the payslip.** Basic, DA, HRA received, employee PF and professional tax are read from the breakdown (matched by name, so AI-decoded labels work too). PF already counts towards 80C, so the 80C slider only offers what is left of the ₹1,50,000 limit.
- **Break-even by binary search.** Old-regime tax only falls as deductions rise, so `oldRegimeBreakEven()` searches for the smallest total deduction whose old-regime tax is at or below the new regime's. Example: on ₹9 lakh the new regime's tax is ₹0, so the old regime needs taxable income ≤ ₹5 lakh — ₹9,00,000 − ₹50,000 − D ≤ ₹5,00,000 → D = ₹3,50,000.
- **Live without flooding the server.** The frontend waits 200 ms for a slider to settle, cancels any request still in flight (`AbortController`), and keeps the previous result on screen (dimmed) while the new one loads. The endpoint has its own rate limit (240 a minute) so slider use never eats into the decode allowance.
- **Slider detail:** a range input can't reach a maximum that isn't a multiple of its step (₹96,000 of 80C left, in ₹5,000 steps, stopped at ₹95,000). The slider counts notches instead, with the last notch landing exactly on the limit.

### 13.3 Testing
`tests/simulator.test.js` (10 tests): break-even values worked by hand for ₹9 lakh and ₹18 lakh; the sample payslip alone (new ₹0 vs old ₹74,069); rent unlocking a ₹1,80,000 HRA exemption (old ₹36,629, hand-worked); PF capping extra 80C at ₹96,000; enough deductions making both regimes ₹0; no HRA without HRA on the payslip; and the API's validation. Checked in the browser at 375, 1440 and 1920 px; at ₹15 lakh with the sliders up, the old regime wins (₹84,261 vs ₹97,500, both hand-checked).

### 13.4 Limitations
- Only the deductions a typical employee can change are modelled — not 80E (education loan), 80G (donations), 80TTA (savings interest) or let-out property.
- The 80D slider tops out at ₹75,000 (₹25,000 family + ₹50,000 senior parents); a senior-citizen employee can claim up to ₹1,00,000.
- Without HRA on the payslip, rent gives no benefit here; section 80GG (rent with no HRA) is not modelled.

---

## 11. Viva Prep Checklist (Day 5)

- [ ] Can explain every formula in §4 without looking it up
- [ ] Can explain why the architecture moved away from Claude (cost, control, no vendor lock-in) and the trade-off (lower ceiling on parsing accuracy for unusual formats, mitigated by the LLM fallback)
- [ ] Can explain the two bugs found during testing (§3) and how they were caught
- [ ] Can justify what was deferred (§6) and why, if asked "why doesn't it do X"
- [ ] Can explain the limitations (§7) proactively rather than being caught off guard
- [ ] Report includes: architecture diagram, formulas, testing methodology, and a "future work" section built directly from §6 and §7

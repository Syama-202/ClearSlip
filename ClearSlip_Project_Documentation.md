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
| Jest + Supertest test suite (98 tests) | `tests/` | ✅ Done — see §9 |
| Tested against 6 real-world payslip formats from Indian HR websites (text + OCR) | `tests/webSamples.test.js` | ✅ Done — 6/6, see §9.1 |
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
| 2 | Old vs New tax regime comparator (add old-regime slab function alongside §4.7) | Most-requested real-world feature; reuses existing engine |
| 2 | History/trend dashboard (Recharts: take-home & tax over time) | Demonstrates data visualization + persistence together |
| 3 | ~~Jest test suite for `rulesEngine.js` and the tax calculator~~ ✅ done (98 tests) — add old-regime tests with the comparator | Shows testing discipline — high grading value for low effort |
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
| What-if investment simulator (live slider-based tax impact) | Interactive UI work, not essential to core evaluation criteria |
| PDF export of the report | Polish item, not core functionality |
| Multi-language support (Hindi/regional, i18next) | High-value for real users but time-intensive to do properly (translation + testing) |
| Reminder system (node-cron + email) | Depends on n8n pipeline extension; scope creep risk |
| Admin analytics dashboard | Nice for a "data" narrative but not essential for a payslip-decoder demo |
| PWA support | Low priority; installability isn't core to the project's value proposition |
| Docker/Compose packaging | Useful for deployment story but not required if Railway/Render deployment works |
| Swagger/OpenAPI docs | Documentation nice-to-have; this document + README cover the same ground for report purposes |

**If ahead of schedule after Day 4**, the recommended order to pick these back up is: Offer comparator → PDF export → What-if simulator (in that order, by effort-to-value ratio).

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

## 9. Testing (done — 98 automated tests, all passing)

Run with `npm test` in `clearslip-backend` (Jest + Supertest).

- **`tests/rulesEngine.test.js` (34 tests)** — number parsing (plain, comma-grouped, Indian lakh format, `k`/`L`/`LPA`/`Cr` units, "Cr" as credit, percentages, OCR-misread ₹ signs); component recognition (two-column OCR lines, YTD columns ignored, real annual columns accepted, "per annum", short labels DA/P.Tax/ESIC); false positives (`Gross Deductions`, `Total Deductions`, `PF No`/`UAN`, `Employer PF`, numbers before any label); OCR ₹-misread correction; confidence/fallback routing; action items.
- **`tests/taxCalculator.test.js` (12 tests)** — 87A rebate up to ₹12L taxable, marginal relief just above it, every slab boundary (₹16L, ₹20L, ₹24L) and a property check that tax never exceeds income above the rebate limit.
- **`tests/webSamples.test.js` (38 tests)** — six sample payslips published on Indian payroll/HR websites (taggd, Kredily, Hirist ×2, sum.money, indianpaycalculator — corporate and central-government formats), each checked **twice**: as pasted text, and as the text Tesseract actually read from an image of it. Fixtures: `tests/fixtures/webSamples.js` (with source URLs) and `tests/fixtures/ocr/`.
- **`tests/api.test.js` (14 tests)** — `POST /api/decode` with text, a text-layer PDF, a scanned PDF, a corrupt PDF, unreadable text with and without the LLM fallback (Groq mocked), Aadhaar rejection, UAN allowed, malformed requests; `POST /api/checklist` without n8n and with a bad email; `GET /api/health`.
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

## 10. Deployment Plan (Day 4)

- Backend → Railway or Render (free tier), env vars (all optional): `GROQ_API_KEY`, `GROQ_MODEL`, `N8N_WEBHOOK_URL`, `N8N_SECRET`, `FRONTEND_URL`.
- Frontend → Vercel or Netlify, env var: `VITE_API_URL` pointing to the deployed backend.
- Verify Tesseract.js can write to a temp/cache directory on the chosen host (needed for OCR language data download on first run).

---

## 11. Viva Prep Checklist (Day 5)

- [ ] Can explain every formula in §4 without looking it up
- [ ] Can explain why the architecture moved away from Claude (cost, control, no vendor lock-in) and the trade-off (lower ceiling on parsing accuracy for unusual formats, mitigated by the LLM fallback)
- [ ] Can explain the two bugs found during testing (§3) and how they were caught
- [ ] Can justify what was deferred (§6) and why, if asked "why doesn't it do X"
- [ ] Can explain the limitations (§7) proactively rather than being caught off guard
- [ ] Report includes: architecture diagram, formulas, testing methodology, and a "future work" section built directly from §6 and §7

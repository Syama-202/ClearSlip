import { useState, useMemo } from 'react'
import { SlidersHorizontal, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import useTaxSimulation from '../hooks/useTaxSimulation.js'
import { formatINR } from '../utils/formatCurrency'

const SECTION_80C_CAP = 150000

// Payslip rows the simulator needs, matched by name so AI-decoded labels work too
const ROW_PATTERNS = {
  basic: /basic/i,
  da: /\bDA\b|dearness/i,
  hra: /\bHRA\b|house rent/i,
  pf: /provident|\bE?PF\b/i,
  pt: /professional tax/i,
}

function fromPayslip(breakdown = []) {
  const annual = (key, type) => breakdown.find(r => r.type === type && ROW_PATTERNS[key].test(r.component))?.annual ?? 0
  return {
    grossAnnual: breakdown.filter(r => r.type === 'earning').reduce((s, r) => s + (r.annual || 0), 0),
    basicAnnual: annual('basic', 'earning'),
    daAnnual: annual('da', 'earning'),
    hraReceivedAnnual: annual('hra', 'earning'),
    employeePfAnnual: annual('pf', 'deduction'),
    professionalTaxAnnual: annual('pt', 'deduction'),
  }
}

const NO_CHOICES = { extra80C: 0, nps80CCD1B: 0, health80D: 0, rentPaidMonthly: 0, metro: false, homeLoanInterest: 0 }

/**
 * What-if tax simulator: drag deductions and see both regimes' tax change.
 * Starts from the decoded payslip; the server does the maths with the same
 * calculator the decoder and Ask ClearSlip use.
 */
export default function WhatIfSimulator({ breakdown }) {
  const payslip = useMemo(() => fromPayslip(breakdown), [breakdown])
  const [gross, setGross] = useState(payslip.grossAnnual)
  const [choices, setChoices] = useState(NO_CHOICES)
  const { result, loading, error } = useTaxSimulation({ ...payslip, grossAnnual: gross, ...choices })

  const set = key => value => setChoices(c => ({ ...c, [key]: value }))
  const pfIn80C = Math.min(payslip.employeePfAnnual, SECTION_80C_CAP)
  const room80C = SECTION_80C_CAP - pfIn80C
  const changed = gross !== payslip.grossAnnual || Object.keys(NO_CHOICES).some(k => choices[k] !== NO_CHOICES[k])

  return (
    <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-terra">
            <SlidersHorizontal size={20} className="text-saffron-500" /> What if…?
          </h2>
          <p className="mt-1 text-base text-muted">Try investments, insurance and rent, and watch your tax change under both regimes.</p>
        </div>
        {changed && (
          <button
            onClick={() => { setGross(payslip.grossAnnual); setChoices(NO_CHOICES) }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-peach hover:text-ink"
          >
            <RotateCcw size={14} /> Reset to my payslip
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* ── Inputs ── */}
        <div className="space-y-5">
          <label className="block">
            <span className="text-base font-medium text-ink">Yearly salary (gross)</span>
            <span className="mt-0.5 block text-sm text-muted">From your payslip — change it to try a raise.</span>
            <div className="mt-2 flex items-center rounded-lg border border-line bg-cream focus-within:border-saffron-500">
              <span className="pl-3 text-base text-muted">₹</span>
              <input
                type="number"
                min="0"
                step="10000"
                inputMode="numeric"
                value={gross || ''}
                onChange={e => setGross(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent px-2 py-2 text-base tabular-nums text-ink outline-none"
              />
            </div>
          </label>

          <p className="rounded-lg bg-sand px-3 py-2 text-sm leading-relaxed text-saffron-700">
            The choices below lower your tax only under the <strong>old regime</strong>. The new regime ignores them.
          </p>

          {room80C > 0 ? (
            <Slider
              label="More 80C investments"
              help={pfIn80C
                ? `ELSS, PPF, life insurance, tuition fees. Your PF already uses ${formatINR(pfIn80C)} of the ₹1,50,000 limit.`
                : 'ELSS, PPF, life insurance, tuition fees, up to ₹1,50,000 a year.'}
              value={choices.extra80C}
              max={room80C}
              step={5000}
              onChange={set('extra80C')}
              suffix="/ year"
            />
          ) : (
            <p className="text-sm text-muted">Your PF already fills the ₹1,50,000 limit under section 80C.</p>
          )}
          <Slider
            label="Your own NPS contribution — 80CCD(1B)"
            help="Extra, on top of the 80C limit."
            value={choices.nps80CCD1B}
            max={50000}
            step={5000}
            onChange={set('nps80CCD1B')}
            suffix="/ year"
          />
          <Slider
            label="Health insurance premium — 80D"
            help="Up to ₹25,000 for your family, plus up to ₹50,000 for senior-citizen parents."
            value={choices.health80D}
            max={75000}
            step={2500}
            onChange={set('health80D')}
            suffix="/ year"
          />
          {payslip.hraReceivedAnnual > 0 ? (
            <div className="space-y-2">
              <Slider
                label="Rent you pay"
                help="Unlocks your HRA exemption."
                value={choices.rentPaidMonthly}
                max={100000}
                step={1000}
                onChange={set('rentPaidMonthly')}
                suffix="/ month"
              />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={choices.metro}
                  onChange={e => set('metro')(e.target.checked)}
                  className="h-4 w-4 accent-saffron-500"
                />
                I live in Delhi, Mumbai, Kolkata or Chennai
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted">Your payslip has no HRA, so rent doesn&apos;t change your tax here.</p>
          )}
          <Slider
            label="Home loan interest — section 24(b)"
            help="For a home you live in, up to ₹2,00,000 a year."
            value={choices.homeLoanInterest}
            max={200000}
            step={5000}
            onChange={set('homeLoanInterest')}
            suffix="/ year"
          />
        </div>

        {/* ── Result ── */}
        <div className="lg:sticky lg:top-24 lg:self-start" aria-live="polite">
          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-maroon-light px-3 py-2 text-sm text-maroon">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {!(gross > 0) && <p className="text-base text-muted">Enter your yearly salary to see your tax.</p>}
          {gross > 0 && !result && !error && (
            <p className="flex items-center gap-2 text-base text-muted"><Loader2 size={16} className="animate-spin" /> Calculating…</p>
          )}
          {gross > 0 && result && <SimulationResult result={result} updating={loading} />}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, help, value, max, step, onChange, suffix }) {
  // The range counts notches, with the last notch landing exactly on `max`, so a
  // limit that isn't a multiple of the step (₹96,000 of 80C left) is reachable
  const notches = Math.ceil(max / step)
  const notch = value >= max ? notches : Math.round(value / step)
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-ink">{label}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums text-terra">
          {formatINR(value)} <span className="text-sm font-normal text-muted">{suffix}</span>
        </span>
      </span>
      <span className="mt-0.5 block text-sm text-muted">{help}</span>
      <input
        type="range"
        min="0"
        max={notches}
        value={notch}
        aria-valuetext={formatINR(Math.min(value, max))}
        onChange={e => onChange(Math.min(Number(e.target.value) * step, max))}
        className="mt-2 w-full accent-saffron-500"
      />
    </label>
  )
}

function SimulationResult({ result, updating }) {
  const { newRegime, oldRegime, better, annualSaving, breakEven, hra } = result
  const highest = Math.max(newRegime.totalTax, oldRegime.totalTax, 1)

  return (
    <div className={`space-y-4 transition-opacity ${updating ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 gap-3">
        <RegimeCard name="New regime" tax={newRegime} lower={better === 'new'} highest={highest} />
        <RegimeCard name="Old regime" tax={oldRegime} lower={better === 'old'} highest={highest} />
      </div>

      <p className="rounded-xl bg-peach px-4 py-3 text-base font-medium text-terra">
        {better === 'same'
          ? 'Both regimes cost you the same.'
          : `The ${better} regime saves you ${formatINR(annualSaving)} a year (${formatINR(annualSaving / 12)} a month).`}
      </p>

      <BreakEven {...breakEven} />

      {hra && (
        <p className="text-sm text-muted">
          HRA exemption: {formatINR(hra.exemption)} a year — the lowest of HRA received ({formatINR(hra.limits.actualHraReceived)}),
          rent minus 10% of basic ({formatINR(hra.limits.rentMinus10PercentOfSalary)}) and {hra.metro ? '50%' : '40%'} of basic ({formatINR(hra.limits.percentOfSalary)}).
        </p>
      )}

      <details className="rounded-xl border border-line px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-terra">How this is calculated</summary>
        {/* Side by side only where each column fits a label and an amount on one line */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          <Steps name="New regime" tax={newRegime} />
          <Steps name="Old regime" tax={oldRegime} />
        </div>
      </details>
    </div>
  )
}

function RegimeCard({ name, tax, lower, highest }) {
  return (
    <div className={`rounded-xl border p-4 ${lower ? 'border-good bg-green-50' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-sm font-medium text-muted">{name}</span>
        {lower && <span className="rounded-full bg-good px-2 py-0.5 text-xs font-semibold text-white">Lower</span>}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${lower ? 'text-good' : 'text-terra'}`}>
        {formatINR(tax.totalTax)}
      </div>
      <div className="text-sm text-muted">a year · {formatINR(tax.monthlyTax)} a month</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all duration-300 ${lower ? 'bg-good' : 'bg-saffron-500'}`}
          style={{ width: `${(tax.totalTax / highest) * 100}%` }}
        />
      </div>
    </div>
  )
}

function BreakEven({ currentDeductions, deductionsNeeded, shortfall }) {
  const progress = deductionsNeeded > 0 ? Math.min(1, currentDeductions / deductionsNeeded) : 1
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="text-sm font-medium text-ink">When does the old regime win?</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {shortfall > 0
          ? <>Once your old-regime deductions pass <strong className="text-ink">{formatINR(deductionsNeeded)}</strong> a year. With these choices they are {formatINR(currentDeductions)}, so {formatINR(shortfall)} short.</>
          : <>Your deductions of <strong className="text-ink">{formatINR(currentDeductions)}</strong> reach the break-even point of {formatINR(deductionsNeeded)}.</>}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Deductions towards break-even">
        <div className={`h-full rounded-full transition-all duration-300 ${shortfall > 0 ? 'bg-saffron-500' : 'bg-good'}`} style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}

function Steps({ name, tax }) {
  const deductions = Object.values(tax.deductions).reduce((a, b) => a + b, 0)
  const rows = [
    ['Gross salary', tax.grossSalary],
    ['Standard deduction', -tax.standardDeduction],
    deductions > 0 && ['Other deductions', -deductions],
    ['Taxable income', tax.taxableIncome, true],
    ['Tax on slabs', tax.taxBeforeRebate],
    tax.rebate87A > 0 && ['Rebate (87A)', -tax.rebate87A],
    tax.marginalRelief > 0 && ['Marginal relief', -tax.marginalRelief],
    ['Cess (4%)', tax.cess],
    ['Total tax', tax.totalTax, true],
  ].filter(Boolean)
  return (
    <div>
      <div className="mb-1 font-semibold text-terra">{name}</div>
      <dl className="space-y-1">
        {rows.map(([label, value, bold]) => (
          <div key={label} className={`flex justify-between gap-3 ${bold ? 'font-semibold text-ink' : 'text-muted'}`}>
            <dt>{label}</dt>
            <dd className="tabular-nums">{value < 0 ? `− ${formatINR(-value)}` : formatINR(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

import { config } from '../config/index.js'
import { getKnowledgeBase } from '../rag/knowledgeBase.js'
import { TOOL_DEFINITIONS, executeTool } from '../rag/tools.js'
import { ASK_SYSTEM_PROMPT } from '../prompts/askPrompt.js'
import { groqChat, GROQ_UNAVAILABLE_CODES } from './groqClient.js'

const TOP_K = 5
// Model turns allowed for tool calls before forcing a final answer
const MAX_TOOL_ROUNDS = 3

// Shown with the passages when the AI can't answer this time
const UNAVAILABLE_NOTICES = {
  GROQ_RATE_LIMITED: 'The AI is busy right now (free-tier limit), so here are the most relevant passages instead. Try again in a minute for a full answer.',
  GROQ_AUTH: "The AI key on this server isn't working (it may have expired), so here are the most relevant passages instead.",
  GROQ_MODEL_UNAVAILABLE: "The AI model configured on this server isn't available, so here are the most relevant passages instead.",
}

const NO_SOURCES_ANSWER =
  "I can only answer questions about Indian salary, payslips and income tax, and I couldn't find anything about this in my sources. Try asking about your take-home pay, PF, HRA, TDS or which tax regime suits you."

/**
 * Answers a question with retrieval-augmented generation:
 *   1. retrieve the most relevant knowledge-base passages (hybrid BM25 + embeddings);
 *   2. refuse if nothing relevant is found;
 *   3. otherwise let the LLM answer from those numbered passages, calling the
 *      tax calculators as tools for any arithmetic, and citing passages as [n].
 * Without a Groq key, or when Groq is unavailable (rate limit, expired key,
 * retired model), it returns the passages alone ("retrieval-only") with a notice.
 */
export async function answerQuestion({ question, payslip, history = [] }) {
  // A follow-up like "and in the old regime?" needs the previous question for context
  const lastUserTurn = [...history].reverse().find(m => m.role === 'user')?.content
  const retrievalQuery = lastUserTurn ? `${lastUserTurn} ${question}` : question

  const retrieval = await getKnowledgeBase().retrieve(retrievalQuery, { k: TOP_K })
  const sources = retrieval.results.map((r, i) => ({
    n: i + 1,
    title: r.title,
    section: r.section,
    reference: r.reference,
    source: r.source,
    text: r.text,
  }))
  const base = { retrievalMethod: retrieval.method, sources, cited: [], toolCalls: [] }

  if (!retrieval.relevant) {
    return { ...base, mode: 'no-sources', answer: NO_SOURCES_ANSWER, sources: [] }
  }
  const sourcesOnly = notice => ({ ...base, mode: 'retrieval-only', answer: null, sources: sources.slice(0, 3), notice })
  if (!config.groqApiKey) return sourcesOnly(null)

  try {
    return { ...base, ...(await generateAnswer({ question, payslip, history, sources })) }
  } catch (err) {
    if (GROQ_UNAVAILABLE_CODES.includes(err.code)) return sourcesOnly(UNAVAILABLE_NOTICES[err.code])
    throw err
  }
}

/** The LLM step: numbered sources + payslip in, a cited answer out, with tool calls for numbers. */
async function generateAnswer({ question, payslip, history, sources }) {
  const messages = [
    { role: 'system', content: `${ASK_SYSTEM_PROMPT}\n\n${formatSources(sources)}\n\n${formatPayslip(payslip)}` },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  const toolCalls = []
  let answer = null
  let useTools = true
  let toolFailures = 0
  // "Which regime?" with a payslip always needs the comparison; left to itself the
  // model sometimes asks for rent first instead of comparing with what it has
  const forcedTool = payslip?.breakdown?.length && /\bregimes?\b/i.test(question) ? 'compare_tax_regimes' : null

  for (let round = 0; round <= MAX_TOOL_ROUNDS && answer === null; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS
    let message
    try {
      message = await groqChat({
        temperature: 0.1,
        // Includes the model's reasoning tokens, so it is well above the ~180-word answer
        max_tokens: 1500,
        messages,
        ...(useTools && { tools: TOOL_DEFINITIONS, tool_choice: toolChoice(round, lastRound, forcedTool) }),
      })
    } catch (err) {
      // The model occasionally emits a malformed tool call. It is usually fine on a
      // second try; if it fails again, answer without tools rather than not at all.
      if (err.code === 'GROQ_TOOL_USE_FAILED' && useTools) {
        toolFailures++
        if (toolFailures >= 2) {
          useTools = false
          messages.push({ role: 'system', content: 'Calculation tools are unavailable for this answer. Do not calculate amounts yourself; say a calculation is not available right now.' })
        }
        round--
        continue
      }
      throw err
    }

    if (message.tool_calls?.length && !lastRound) {
      messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls })
      for (const call of message.tool_calls) {
        const args = parseArguments(call.function?.arguments)
        const result = executeTool(call.function?.name, args)
        toolCalls.push({ name: call.function?.name, args, result })
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    } else {
      answer = normalizeCitations((message.content ?? '').trim())
    }
  }

  return { mode: 'rag', answer, cited: citedNumbers(answer, sources.length), toolCalls }
}

function toolChoice(round, lastRound, forcedTool) {
  if (lastRound) return 'none'
  if (round === 0 && forcedTool) return { type: 'function', function: { name: forcedTool } }
  return 'auto'
}

function formatSources(sources) {
  return 'SOURCES:\n' + sources.map(s => `[${s.n}] ${s.title} — ${s.section} (${s.reference})\n${s.text}`).join('\n\n')
}

function formatPayslip(payslip) {
  if (!payslip?.breakdown?.length) return "THEIR PAYSLIP: not provided. Ask for the figures you need."
  // Indian digit grouping, so the model quotes "₹9,00,000" rather than inventing a format
  const inr = n => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
  const lines = payslip.breakdown.map(b => `- ${b.component} (${b.type}): ${inr(b.monthly)}/month, ${inr(b.annual)}/year`)
  const grossAnnual = payslip.breakdown.filter(b => b.type === 'earning').reduce((s, b) => s + (b.annual || 0), 0)
  const s = payslip.summary ?? {}
  return [
    'THEIR PAYSLIP (decoded by ClearSlip):',
    ...lines,
    `Annual gross salary (sum of earnings): ${inr(grossAnnual)}`,
    s.takeHome != null && `Take-home: ${inr(s.takeHome)}/month`,
    s.tds != null && `TDS: ${inr(s.tds)}/year`,
  ].filter(Boolean).join('\n')
}

function parseArguments(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
  } catch {
    return {}
  }
}

/**
 * gpt-oss models cite in their native 【2】 or 【2†source】 style; turn that into [2].
 * Calculator figures sometimes get a made-up "[tool output]" citation; drop it, since
 * the UI already shows the calculation next to the answer.
 */
export function normalizeCitations(answer) {
  return answer
    .replace(/【\s*(\d+)[^】]*】/g, '[$1]')
    .replace(/\s*【[^】]*】/g, '')
    .replace(/\s*\[(tool|calculator|functions?)[^\]]*\]/gi, '')
}

/** Source numbers the answer actually cites, in order of first use. */
export function citedNumbers(answer, count) {
  const seen = []
  for (const m of (answer ?? '').matchAll(/\[(\d+)(?:\s*,\s*(\d+))*\]/g)) {
    for (const n of m[0].match(/\d+/g).map(Number)) {
      if (n >= 1 && n <= count && !seen.includes(n)) seen.push(n)
    }
  }
  return seen
}

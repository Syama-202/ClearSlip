import { config } from '../config/index.js'
import { getKnowledgeBase } from '../rag/knowledgeBase.js'
import { TOOL_DEFINITIONS, executeTool } from '../rag/tools.js'
import { ASK_SYSTEM_PROMPT } from '../prompts/askPrompt.js'
import { groqChat, groqChatStream, GROQ_UNAVAILABLE_CODES } from './groqClient.js'
import { structureAnswer, checkCitations, traceAmounts, looksLikeInstructions } from './answerChecks.js'

const TOP_K = 5
// Model turns allowed for tool calls before forcing a final answer
const MAX_TOOL_ROUNDS = 3

// Shown with the passages when the AI can't answer this time
const UNAVAILABLE_NOTICES = {
  GROQ_RATE_LIMITED: 'The AI is busy right now (free-tier limit), so here are the most relevant passages instead. Try again in a minute for a full answer.',
  GROQ_AUTH: "The AI key on this server isn't working (it may have expired), so here are the most relevant passages instead.",
  GROQ_MODEL_UNAVAILABLE: "The AI model configured on this server isn't available, so here are the most relevant passages instead.",
  GROQ_SERVER: 'The AI service is having problems right now, so here are the most relevant passages instead. Try again in a few minutes for a full answer.',
  GROQ_TIMEOUT: 'The AI took too long to answer, so here are the most relevant passages instead. Try again for a full answer.',
  GROQ_NETWORK: "ClearSlip couldn't reach the AI service, so here are the most relevant passages instead. Try again in a few minutes for a full answer.",
}

// A question that tries to change how ClearSlip answers is declined in code,
// before retrieval or any AI call (see looksLikeInstructions)
const DECLINED_ANSWER =
  "I can't follow instructions that change how I answer. Ask your question about salary, payslips or tax on its own, and I'll answer it from official sources."

const NO_SOURCES_ANSWER =
  "I can only answer questions about Indian salary, payslips and income tax, and I couldn't find anything about this in my sources. Try asking about your take-home pay, PF, HRA, TDS or which tax regime suits you."

// A short question that matched nothing, asked with a payslip open ("Is this good?"),
// is more likely vague than off-topic: ask what they mean instead of refusing
const CLARIFY_ANSWER =
  "I'm not sure what you'd like to know about your payslip. I can explain any part of it, check your tax, or compare the two tax regimes — for example:"
const CLARIFY_SUGGESTIONS = [
  'Is my take-home pay right?',
  'Am I paying too much tax?',
  'Which tax regime is better for me?',
  'Why is PF deducted from my salary?',
]
const MAX_VAGUE_WORDS = 6

// Words that make a question lean on the previous one ("and in the old regime?",
// "what about that?"); only then is the previous question added for retrieval
const FOLLOW_UP_RE = /^(and|also|so|then|but|what about|how about|ok|okay)\b|\b(it|that|this|those|these|them|same)\b/i
// A fragment this short ("old regime?") only makes sense with the previous question
const MAX_FRAGMENT_WORDS = 3

/**
 * The text to search the knowledge base with. A follow-up borrows the previous
 * question's topic; a new, self-contained question is searched on its own, so
 * switching topic ("…regime?" then "How do I check my PF balance?") isn't
 * pulled back to the old one.
 */
export function retrievalQueryFor(question, history = []) {
  const lastUserTurn = [...history].reverse().find(m => m.role === 'user')?.content
  const words = question.trim().split(/\s+/).length
  const isFollowUp = lastUserTurn && (FOLLOW_UP_RE.test(question) || words <= MAX_FRAGMENT_WORDS)
  return isFollowUp ? `${lastUserTurn} ${question}` : question
}

/**
 * Answers a question with retrieval-augmented generation:
 *   1. retrieve the most relevant knowledge-base passages (hybrid BM25 + embeddings);
 *   2. refuse if nothing relevant is found;
 *   3. otherwise let the LLM answer from those numbered passages, calling the
 *      tax calculators as tools for any arithmetic, and citing passages as [n].
 * Without a Groq key, or when Groq is unavailable (rate limit, expired key,
 * retired model), it returns the passages alone ("retrieval-only") with a notice.
 */
// Answers to general questions — no payslip, no chat history — are the same for
// everyone, so they are kept for `config.askCacheTtlMs`: a repeat costs no AI
// tokens and comes back at once. Anything with a payslip is never cached, and
// nor is an answer any check flagged: a doubtful answer is never replayed to others.
const answerCache = new Map() // normalised question → { at, data }
const MAX_CACHED_ANSWERS = 200
const cacheKey = question => question.trim().toLowerCase().replace(/[^\p{L}\p{N}₹]+/gu, ' ').trim()

export function clearAnswerCache() {
  answerCache.clear()
}

// `signal` cancels the AI call when the user leaves before the answer is done
export async function answerQuestion({ question, payslip, history = [], stream, signal }) {
  const cacheable = config.askCacheTtlMs > 0 && !payslip?.breakdown?.length && !history.length
  const key = cacheable && cacheKey(question)
  const hit = key && answerCache.get(key)
  if (hit && Date.now() - hit.at < config.askCacheTtlMs) return { ...hit.data, cached: true }

  const data = await answerUncached({ question, payslip, history, stream, signal })
  // Only full AI answers that passed every check: a sources-only reply (AI busy)
  // should be retried next time, and a flagged one shouldn't be repeated
  if (key && data.mode === 'rag' && checksPassed(data.checks)) {
    answerCache.delete(key)
    answerCache.set(key, { at: Date.now(), data })
    if (answerCache.size > MAX_CACHED_ANSWERS) answerCache.delete(answerCache.keys().next().value)
  }
  return data
}

export function checksPassed(checks = {}) {
  return !checks.untracedAmounts?.length && !checks.fromQuestion?.length && !checks.invalidCitations?.length
    && !checks.noCitations && !checks.calculationWithoutTool
}

async function answerUncached({ question, payslip, history, stream, signal }) {
  if (looksLikeInstructions(question)) {
    return { retrievalMethod: null, sources: [], cited: [], toolCalls: [], mode: 'declined', answer: DECLINED_ANSWER }
  }
  const retrieval = await getKnowledgeBase().retrieve(retrievalQueryFor(question, history), { k: TOP_K })
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
    const vague = payslip?.breakdown?.length && question.trim().split(/\s+/).length <= MAX_VAGUE_WORDS
    return vague
      ? { ...base, mode: 'clarify', answer: CLARIFY_ANSWER, suggestions: CLARIFY_SUGGESTIONS, sources: [] }
      : { ...base, mode: 'no-sources', answer: NO_SOURCES_ANSWER, sources: [] }
  }
  const sourcesOnly = notice => ({ ...base, mode: 'retrieval-only', answer: null, sources: sources.slice(0, 3), notice })
  if (!config.groqApiKey) return sourcesOnly(null)

  try {
    return { ...base, ...(await generateAnswer({ question, payslip, history, sources, stream, signal })) }
  } catch (err) {
    stream?.onReset() // drop any text already streamed; the fallback replaces it
    if (GROQ_UNAVAILABLE_CODES.includes(err.code)) return sourcesOnly(UNAVAILABLE_NOTICES[err.code])
    throw err
  }
}

/**
 * The LLM step: numbered sources + payslip in, a cited answer out, with tool calls
 * for numbers. With `stream` ({ onText, onReset }), the answer is sent piece by
 * piece as it is written; the checked, structured answer is still returned at the end.
 */
async function generateAnswer({ question, payslip, history, sources, stream, signal }) {
  let streamedThisRound = false
  const chat = body => (stream
    ? groqChatStream(body, text => { streamedThisRound = true; stream.onText(text) }, { signal })
    : groqChat(body, { signal }))

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
    streamedThisRound = false
    try {
      message = await chat({
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
        if (streamedThisRound) stream.onReset()
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
      // Any text written before a tool call is not the answer
      if (streamedThisRound) stream.onReset()
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

  // Checks in code, so what the user sees doesn't rest on the model following its prompt
  const { answer: checked, invalid: invalidCitations } = checkCitations(answer, sources.length)
  const cited = citedNumbers(checked, sources.length)
  const parts = structureAnswer(checked)
  // Figures the user gave in this conversation, so their own rent or salary isn't "untraced"
  const asked = [...history.filter(m => m.role === 'user').map(m => m.content), question].join('\n')
  const amounts = traceAmounts(checked, { payslip, toolCalls, sources, cited, question: asked })
  return {
    mode: 'rag',
    answer: checked,
    parts,
    cited,
    toolCalls,
    checks: {
      // ₹ figures that match nothing in the payslip, a calculator or a cited source
      untracedAmounts: amounts.untraced,
      // ₹ figures found only in what the user typed
      fromQuestion: amounts.fromQuestion,
      invalidCitations,
      noCitations: cited.length === 0,
      // A "Calculation" part with no calculator call behind it was worked out by the model
      calculationWithoutTool: Boolean(parts?.some(p => p.kind === 'calculation')) && toolCalls.length === 0,
    },
  }
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
    .replace(/\s*\[(tool|calculator|functions?|display)[^\]]*\]/gi, '')
    // Notes the model adds about where a figure came from: "(tool output)", "(as returned by the tax calculator)"
    .replace(/\s*\((?:tool output|display[^)]*|as returned by the (?:tax )?calculator|from the tool)\)/gi, '')
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

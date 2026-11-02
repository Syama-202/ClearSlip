import { config } from '../config/index.js'
import { getKnowledgeBase } from '../rag/knowledgeBase.js'
import { TOOL_DEFINITIONS, executeTool } from '../rag/tools.js'
import { ASK_SYSTEM_PROMPT } from '../prompts/askPrompt.js'
import { groqChat } from './groqClient.js'

const TOP_K = 5
// Model turns allowed for tool calls before forcing a final answer
const MAX_TOOL_ROUNDS = 3

const NO_SOURCES_ANSWER =
  "I can only answer questions about Indian salary, payslips and income tax, and I couldn't find anything about this in my sources. Try asking about your take-home pay, PF, HRA, TDS or which tax regime suits you."

/**
 * Answers a question with retrieval-augmented generation:
 *   1. retrieve the most relevant knowledge-base passages (hybrid BM25 + embeddings);
 *   2. refuse if nothing relevant is found;
 *   3. otherwise let the LLM answer from those numbered passages, calling the
 *      tax calculators as tools for any arithmetic, and citing passages as [n].
 * Without a Groq key it returns the passages alone ("retrieval-only").
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
  if (!config.groqApiKey) {
    return { ...base, mode: 'retrieval-only', answer: null, sources: sources.slice(0, 3) }
  }

  const messages = [
    { role: 'system', content: `${ASK_SYSTEM_PROMPT}\n\n${formatSources(sources)}\n\n${formatPayslip(payslip)}` },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  const toolCalls = []
  let answer = null
  let useTools = true

  for (let round = 0; round <= MAX_TOOL_ROUNDS && answer === null; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS
    let message
    try {
      message = await groqChat({
        temperature: 0.1,
        max_tokens: 700,
        messages,
        ...(useTools && { tools: TOOL_DEFINITIONS, tool_choice: lastRound ? 'none' : 'auto' }),
      })
    } catch (err) {
      // The model occasionally emits a malformed tool call — retry once without tools
      if (err.code === 'GROQ_TOOL_USE_FAILED' && useTools) {
        useTools = false
        messages.push({ role: 'system', content: 'Calculation tools are unavailable for this answer. Do not calculate amounts yourself; say a calculation is not available right now.' })
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
      answer = (message.content ?? '').trim()
    }
  }

  return { ...base, mode: 'rag', answer, cited: citedNumbers(answer, sources.length), toolCalls }
}

function formatSources(sources) {
  return 'SOURCES:\n' + sources.map(s => `[${s.n}] ${s.title} — ${s.section} (${s.reference})\n${s.text}`).join('\n\n')
}

function formatPayslip(payslip) {
  if (!payslip?.breakdown?.length) return "THEIR PAYSLIP: not provided. Ask for the figures you need."
  const lines = payslip.breakdown.map(b => `- ${b.component} (${b.type}): ₹${b.monthly}/month, ₹${b.annual}/year`)
  const grossAnnual = payslip.breakdown.filter(b => b.type === 'earning').reduce((s, b) => s + (b.annual || 0), 0)
  const s = payslip.summary ?? {}
  return [
    'THEIR PAYSLIP (decoded by ClearSlip):',
    ...lines,
    `Annual gross salary (sum of earnings): ₹${grossAnnual}`,
    s.takeHome != null && `Take-home: ₹${s.takeHome}/month`,
    s.tds != null && `TDS: ₹${s.tds}/year`,
  ].filter(Boolean).join('\n')
}

function parseArguments(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
  } catch {
    return {}
  }
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

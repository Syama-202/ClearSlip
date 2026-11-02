// Retrieval evaluation: how often the right document comes back, per method.
//   npm run rag:eval
// Metrics (document-level): Hit@1 and Hit@3 — a correct document is ranked
// first / in the top 3; MRR — mean of 1 / rank of the first correct document.
// Also checks the "nothing relevant" guard on off-topic questions.
process.env.RAG_DENSE = 'on'

const { getKnowledgeBase } = await import('../src/rag/knowledgeBase.js')
const { EVAL_QUESTIONS, OFF_TOPIC_QUESTIONS } = await import('../tests/fixtures/ragEval.js')

const kb = getKnowledgeBase()
const rows = []
const misses = {}

for (const method of ['bm25', 'dense', 'hybrid']) {
  let hit1 = 0, hit3 = 0, rr = 0
  misses[method] = []
  for (const { q, docs } of EVAL_QUESTIONS) {
    const { results, method: used } = await kb.retrieve(q, { k: 10, method })
    if (used !== method) throw new Error(`Wanted ${method} but got ${used} — is the embedding model available?`)
    const rank = results.findIndex(r => docs.includes(r.docId)) + 1
    if (rank === 1) hit1++
    if (rank >= 1 && rank <= 3) hit3++
    if (rank >= 1) rr += 1 / rank
    if (rank !== 1) misses[method].push(`${q}  → got ${results[0]?.docId} (correct at rank ${rank || '>10'})`)
  }
  const n = EVAL_QUESTIONS.length
  rows.push({ method, 'Hit@1': pct(hit1 / n), 'Hit@3': pct(hit3 / n), MRR: (rr / n).toFixed(3) })
}

let refused = 0
for (const q of OFF_TOPIC_QUESTIONS) if (!(await kb.retrieve(q)).relevant) refused++
let answered = 0
for (const { q } of EVAL_QUESTIONS) if ((await kb.retrieve(q)).relevant) answered++

console.log(`\nRetrieval evaluation — ${EVAL_QUESTIONS.length} questions, ${kb.chunks.length} chunks\n`)
console.table(rows)
console.log(`Relevance guard: ${refused}/${OFF_TOPIC_QUESTIONS.length} off-topic questions refused, ${answered}/${EVAL_QUESTIONS.length} on-topic questions answered\n`)
for (const [method, list] of Object.entries(misses)) {
  if (list.length) console.log(`${method} — not ranked first:\n  ${list.join('\n  ')}\n`)
}

function pct(x) { return `${(x * 100).toFixed(1)}%` }

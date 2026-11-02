// Precomputes embeddings for every knowledge-base chunk into src/rag/index.json,
// so the server doesn't have to embed the corpus at runtime.
// Run after editing anything in src/rag/corpus:  npm run rag:index
import fs from 'fs'
import { loadCorpus, corpusHash } from '../src/rag/corpus.js'
import { embed, EMBEDDING_MODEL } from '../src/rag/embeddings.js'
import { INDEX_FILE } from '../src/rag/knowledgeBase.js'

const chunks = loadCorpus()
console.log(`Embedding ${chunks.length} chunks with ${EMBEDDING_MODEL}…`)
const started = Date.now()
const vectors = await embed(chunks.map(c => `${c.title}. ${c.section}. ${c.text}`))

const index = {
  model: EMBEDDING_MODEL,
  corpusHash: corpusHash(chunks),
  dimensions: vectors[0].length,
  builtAt: new Date().toISOString(),
  // 5 decimals keeps the file small with no measurable effect on ranking
  embeddings: Object.fromEntries(chunks.map((c, i) => [c.id, vectors[i].map(v => Math.round(v * 1e5) / 1e5)])),
}
fs.writeFileSync(INDEX_FILE, JSON.stringify(index))
console.log(`Wrote ${INDEX_FILE} (${chunks.length} × ${index.dimensions}) in ${((Date.now() - started) / 1000).toFixed(1)}s`)

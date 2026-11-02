import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadCorpus, corpusHash } from './corpus.js'
import { BM25 } from './bm25.js'
import { embed, dot, EMBEDDING_MODEL } from './embeddings.js'
import { config } from '../config/index.js'

export const INDEX_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.json')

// Reciprocal Rank Fusion constant (Cormack et al., 2009)
const RRF_K = 60

// Below both of these, nothing in the knowledge base is about the question.
// Set from the evaluation set (npm run rag:eval): off-topic questions top out
// at BM25 ≈ 4.0 / similarity ≈ 0.49 (single-word hits like "fix" → "fixed
// deposit"), on-topic ones start at ≈ 6.0 / 0.60 — thresholds sit between.
const MIN_BM25_SCORE = 5
const MIN_DENSE_SIMILARITY = 0.55

/**
 * The knowledge base: corpus chunks with a BM25 index, plus embeddings for
 * dense retrieval. Embeddings come from src/rag/index.json (built by
 * `npm run rag:index`) when it matches the current corpus; otherwise they
 * are computed on first use.
 */
class KnowledgeBase {
  constructor() {
    this.chunks = loadCorpus()
    this.hash = corpusHash(this.chunks)
    // Title and section are repeated so a match there counts more than one in the body
    this.bm25 = new BM25(this.chunks.map(c => `${c.title} ${c.section} ${c.section} ${c.text}`))
    this.embeddings = this.loadStoredEmbeddings()
    this.denseFailed = false
  }

  loadStoredEmbeddings() {
    try {
      const stored = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
      if (stored.corpusHash !== this.hash || stored.model !== EMBEDDING_MODEL) {
        console.warn('[rag] index.json is out of date — run `npm run rag:index`. Embeddings will be computed at runtime.')
        return null
      }
      return this.chunks.map(c => stored.embeddings[c.id])
    } catch {
      return null
    }
  }

  async ensureEmbeddings() {
    if (!this.embeddings) {
      this.embeddings = await embed(this.chunks.map(c => `${c.title}. ${c.section}. ${c.text}`))
    }
    return this.embeddings
  }

  get denseEnabled() {
    return config.ragDense && !this.denseFailed
  }

  bm25Ranking(query) {
    return this.bm25.search(query)
  }

  async denseRanking(query) {
    const [embeddings, [queryVector]] = await Promise.all([this.ensureEmbeddings(), embed([query], { isQuery: true })])
    return embeddings
      .map((vector, index) => ({ index, score: dot(vector, queryVector) }))
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Returns the top-k chunks for a question.
   * method: 'hybrid' (BM25 + dense fused with RRF, the default), 'bm25' or 'dense'.
   * Falls back to BM25 when dense retrieval is off or its model can't load.
   * `relevant` is false when neither ranking finds anything close enough —
   * the caller uses it to refuse instead of answering from unrelated text.
   */
  async retrieve(query, { k = 5, method = 'hybrid' } = {}) {
    const bm25 = this.bm25Ranking(query)
    let dense = null
    if (method !== 'bm25' && this.denseEnabled) {
      try {
        dense = await this.denseRanking(query)
      } catch (err) {
        console.warn(`[rag] dense retrieval unavailable, using BM25 only: ${err.message}`)
        this.denseFailed = true
      }
    }

    const usedMethod = dense ? method : 'bm25'
    let ranked
    if (usedMethod === 'bm25') ranked = bm25
    else if (usedMethod === 'dense') ranked = dense
    else ranked = fuse([bm25, dense])

    const relevant = (bm25[0]?.score ?? 0) >= MIN_BM25_SCORE || (dense?.[0]?.score ?? 0) >= MIN_DENSE_SIMILARITY

    return {
      method: usedMethod,
      relevant,
      results: ranked.slice(0, k).map(({ index, score }) => ({ ...this.chunks[index], score: round(score) })),
    }
  }
}

/** Reciprocal Rank Fusion: score = Σ 1 / (RRF_K + rank) over the rankings a chunk appears in. */
export function fuse(rankings) {
  const scores = new Map()
  for (const ranking of rankings) {
    ranking.forEach(({ index }, rank) => scores.set(index, (scores.get(index) || 0) + 1 / (RRF_K + rank + 1)))
  }
  return [...scores].map(([index, score]) => ({ index, score })).sort((a, b) => b.score - a.score)
}

const round = n => Math.round(n * 10000) / 10000

let instance = null
export function getKnowledgeBase() {
  if (!instance) instance = new KnowledgeBase()
  return instance
}

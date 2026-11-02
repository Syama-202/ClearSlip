/**
 * Sentence embeddings computed locally with transformers.js — free, no API
 * key. The model (~35 MB) downloads from Hugging Face on first use and is
 * cached on disk afterwards.
 */

export const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5'

// bge models expect this instruction in front of search queries (not passages)
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: '

let extractorPromise = null

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' }))
      .catch(err => {
        extractorPromise = null // allow a retry later
        throw err
      })
  }
  return extractorPromise
}

/** Embeds passages (or one query) into unit-length vectors, so cosine similarity = dot product. */
export async function embed(texts, { isQuery = false } = {}) {
  const extractor = await getExtractor()
  const input = texts.map(t => (isQuery ? QUERY_PREFIX + t : t))
  const output = await extractor(input, { pooling: 'cls', normalize: true })
  return output.tolist()
}

export function dot(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

/**
 * BM25 keyword search (Robertson & Zaragoza), with a few payslip-specific
 * touches: abbreviations are expanded to their full terms ("HRA" ↔ "house
 * rent allowance") and section numbers like "80C" stay single tokens.
 */

const STOPWORDS = new Set(`a an and are as at be but by can do does for from how i if in into is it its me my of on or our so than that the their them then there these this to was we what when where which who why will with you your
am been being did doing had has have having he her his she they us very would should could also just only about above after again all any because before below between both each few further more most no nor not off once other out over own same some such too under until up while`.split(/\s+/))

// Common payslip abbreviations and their full forms, so either matches the other
const SYNONYMS = [
  ['hra', 'house rent allowance'],
  ['pf', 'provident fund epf'],
  ['epf', 'provident fund'],
  ['vpf', 'voluntary provident fund'],
  ['tds', 'tax deducted source'],
  ['nps', 'national pension system'],
  ['lta', 'leave travel allowance'],
  ['esi', 'employees state insurance'],
  ['esic', 'employees state insurance'],
  ['pt', 'professional tax'],
  ['ctc', 'cost company'],
  ['da', 'dearness allowance'],
  ['itr', 'income tax return'],
  ['uan', 'universal account number'],
  ['salary', 'pay'],
  ['rent', 'hra'],
  ['regime', 'slab'],
  ['refund', 'excess tds'],
  // Everyday words for the same things ("my flat", "my mum and dad")
  ['flat', 'rent hra'],
  ['apartment', 'rent hra'],
  ['accommodation', 'rent hra'],
  ['landlord', 'rent'],
  ['medical', 'health insurance'],
  ['mum', 'parents'],
  ['mom', 'parents'],
  ['dad', 'parents'],
  ['retire', 'retirement provident fund pension'],
  // Common Hinglish words
  ['katega', 'deducted'],
  ['kat', 'deducted'],
  ['kata', 'deducted'],
  ['zyada', 'excess high'],
  ['naya', 'new'],
  ['purana', 'old'],
  ['tankhwah', 'salary'],
]
const SYNONYM_MAP = new Map(SYNONYMS.map(([k, v]) => [k, v.split(' ')]))

// Light stemming: plural and common suffixes, enough for this vocabulary
function stem(word) {
  if (/^\d/.test(word) || word.length <= 3) return word
  return word
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ed)$/, '')
    .replace(/(?<!s)s$/, '')
}

export function tokenize(text, { expand = false } = {}) {
  const words = text.toLowerCase().replace(/₹/g, ' ').match(/[a-z0-9]+(?:\([a-z0-9]+\))*/g) ?? []
  const tokens = []
  for (const raw of words) {
    // "80ccd(1b)" → "80ccd1b"; keep section numbers whole
    const word = raw.replace(/[()]/g, '')
    if (STOPWORDS.has(word)) continue
    tokens.push(stem(word))
    if (expand && SYNONYM_MAP.has(word)) tokens.push(...SYNONYM_MAP.get(word).map(stem))
  }
  return tokens
}

export class BM25 {
  constructor(documents, { k1 = 1.4, b = 0.75 } = {}) {
    this.k1 = k1
    this.b = b
    this.docs = documents.map(d => tokenize(d))
    this.avgLength = this.docs.reduce((s, d) => s + d.length, 0) / Math.max(1, this.docs.length)
    this.termFreqs = this.docs.map(tokens => {
      const tf = new Map()
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
      return tf
    })
    const docFreq = new Map()
    for (const tf of this.termFreqs) for (const t of tf.keys()) docFreq.set(t, (docFreq.get(t) || 0) + 1)
    const n = this.docs.length
    this.idf = new Map([...docFreq].map(([t, df]) => [t, Math.log(1 + (n - df + 0.5) / (df + 0.5))]))
  }

  /** Returns [{ index, score }] for documents with a positive score, best first. */
  search(query) {
    const terms = [...new Set(tokenize(query, { expand: true }))]
    const results = []
    this.termFreqs.forEach((tf, index) => {
      const lengthNorm = this.k1 * (1 - this.b + this.b * this.docs[index].length / this.avgLength)
      let score = 0
      for (const term of terms) {
        const f = tf.get(term)
        if (f) score += this.idf.get(term) * (f * (this.k1 + 1)) / (f + lengthNorm)
      }
      if (score > 0) results.push({ index, score })
    })
    return results.sort((a, b) => b.score - a.score)
  }
}

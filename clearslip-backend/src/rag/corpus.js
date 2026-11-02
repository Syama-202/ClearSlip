import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

export const CORPUS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'corpus')

/**
 * Reads the knowledge-base documents (markdown with a small front-matter
 * block: title, source, reference) and splits each into one chunk per
 * "## " section. Sections are short and self-contained, so a chunk is
 * exactly the passage an answer cites.
 */
export function loadCorpus(dir = CORPUS_DIR) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
  return files.flatMap(file => chunkDocument(path.basename(file, '.md'), fs.readFileSync(path.join(dir, file), 'utf8')))
}

export function chunkDocument(docId, markdown) {
  const text = markdown.replace(/\r\n/g, '\n')
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/)
  const meta = Object.fromEntries(
    (fm?.[1] ?? '').split('\n').map(line => line.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()])
  )
  const body = fm ? text.slice(fm[0].length) : text

  return body.split(/^## /m).slice(1).map(block => {
    const [heading, ...rest] = block.split('\n')
    const section = heading.trim()
    return {
      id: `${docId}#${slugify(section)}`,
      docId,
      title: meta.title || docId,
      section,
      source: meta.source || null,
      reference: meta.reference || null,
      text: rest.join('\n').trim(),
    }
  })
}

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Changes whenever any chunk changes — used to tell if stored embeddings are stale. */
export function corpusHash(chunks) {
  const hash = crypto.createHash('sha256')
  for (const c of chunks) hash.update(`${c.id}\n${c.title}\n${c.section}\n${c.text}\n`)
  return hash.digest('hex').slice(0, 16)
}

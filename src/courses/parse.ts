import { WORDS } from '../data/pack'

export type ParsedCourse = {
  title: string
  wordIds: string[]
  unknown: string[]
}

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z'-]/g, '')
}

export function parseCourseTable(text: string, title = '自定义课程'): ParsedCourse {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { title?: string; words?: string[]; wordIds?: string[] }
      return parseCourseTable((parsed.wordIds ?? parsed.words ?? []).join('\n'), parsed.title || title)
    } catch {
      return { title, wordIds: [], unknown: ['invalid-json'] }
    }
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const unknown: string[] = []
  const wordIds: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const token = normalizeToken(line.split(/[,，\t ]/)[0] ?? '')
    if (!token || token === 'word' || token === 'words') continue
    const hit = WORDS.find((word) => word.word === token || word.id === token)
    if (!hit) {
      unknown.push(token)
      continue
    }
    if (seen.has(hit.id)) continue
    seen.add(hit.id)
    wordIds.push(hit.id)
  }
  return { title, wordIds, unknown }
}

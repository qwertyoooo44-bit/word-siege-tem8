import { WORDS } from '../data/pack'

export function catalogIndexById(wordId: string): number {
  return WORDS.findIndex((word) => word.id === wordId)
}

export function nextCourseCatalogIndex(wordIds: string[], currentWordId: string): number | null {
  const current = wordIds.indexOf(currentWordId)
  const start = current >= 0 ? current + 1 : 0
  for (let i = start; i < wordIds.length; i += 1) {
    const index = catalogIndexById(wordIds[i] ?? '')
    if (index >= 0) return index
  }
  return null
}

export function firstCourseCatalogIndex(wordIds: string[]): number | null {
  for (const id of wordIds) {
    const index = catalogIndexById(id)
    if (index >= 0) return index
  }
  return null
}

export function courseProgress(wordIds: string[], masteredIds: Set<string>): { done: number; total: number } {
  const unique = Array.from(new Set(wordIds))
  const done = unique.filter((id) => masteredIds.has(id)).length
  return { done, total: unique.length }
}

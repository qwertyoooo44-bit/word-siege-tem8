import sample from './sample40.json'
import { TEM8_META } from './tem8.meta'

export type PackWord = {
  id: string
  word: string
  ipa: string
  pos: string
  gloss: string
  definition: string
  context: string
  exampleTranslation: string
  syllable: string
  root: string
  etymology: string
  pronunciationRegion: string
  chapter: number
  source: string
  license: string
  learnable: boolean
  missing: string[]
}

export type PackIndexEntry = {
  id: string
  word: string
  chapter: number
}

export const SAMPLE_WORDS = sample as PackWord[]
export const PACK_META = TEM8_META
export const OFFICIAL_PACK_URL = `${import.meta.env.BASE_URL}packs/tem8.json`

export let WORDS: PackWord[] = SAMPLE_WORDS.slice()
export let PACK_INDEX: PackIndexEntry[] = SAMPLE_WORDS.map((word) => ({
  id: word.id,
  word: word.word,
  chapter: word.chapter,
}))

export function officialPackLoaded(): boolean {
  return WORDS.length === PACK_META.learnableCount
}

export async function loadOfficialPack(): Promise<PackWord[]> {
  if (officialPackLoaded()) return WORDS
  if (typeof fetch === 'undefined') return WORDS
  const res = await fetch(OFFICIAL_PACK_URL)
  if (!res.ok) return WORDS
  const data = (await res.json()) as PackWord[]
  if (!Array.isArray(data) || data.length !== PACK_META.learnableCount) return WORDS
  WORDS = data
  PACK_INDEX = data.map((word) => ({ id: word.id, word: word.word, chapter: word.chapter }))
  return WORDS
}

export function displayGloss(word: PackWord): string {
  return word.gloss
}

export function displayContext(word: PackWord): string {
  return word.context
}

export function displayIpa(word: PackWord): string {
  const ipa = word.ipa.trim()
  if (!ipa) return ''
  const region = word.pronunciationRegion.trim()
  if (region === 'UK' || region.startsWith('UK')) return `UK IPA ${ipa}`
  return ipa
}

export function catalogIndexToQueue(index: number): number {
  return Math.min(Math.max(0, index), Math.max(0, WORDS.length - 1))
}

export function catalogIndexById(wordId: string): number {
  return WORDS.findIndex((word) => word.id === wordId)
}

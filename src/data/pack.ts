import tem8 from './tem8.json'
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

export const WORDS = tem8 as PackWord[]
export const PACK_META = TEM8_META

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

import { readFileSync } from 'node:fs'
import { PACK_META, type PackWord } from './src/data/pack'
import * as pack from './src/data/pack'

const words = JSON.parse(readFileSync('public/packs/tem8.json', 'utf8')) as PackWord[]
if (words.length !== PACK_META.learnableCount) {
  throw new Error(`official pack expected ${PACK_META.learnableCount}, got ${words.length}`)
}
pack.WORDS.splice(0, pack.WORDS.length, ...words)
pack.PACK_INDEX.splice(0, pack.PACK_INDEX.length, ...words.map((word) => ({
  id: word.id,
  word: word.word,
  chapter: word.chapter,
})))
if (pack.SAMPLE_WORDS.length !== 40) throw new Error('sample pack missing')

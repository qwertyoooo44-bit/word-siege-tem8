import { PACK_INDEX, PACK_META, SAMPLE_WORDS, WORDS } from '../data/pack'
import type { PackMeta } from './types'

export const TEM8_PACK: PackMeta = {
  packId: PACK_META.packId,
  title: PACK_META.title,
  description: PACK_META.notice,
  dialect: 'en-GB-source / en-US-speech',
  level: 'TEM8',
  categories: ['academic', 'tem8'],
  version: '1.1.0',
  source: PACK_META.sourceRepo,
  sourceRevision: PACK_META.sourceFile,
  license: PACK_META.dataLicense,
  attribution: PACK_META.attribution,
  sha256: 'see public/packs/tem8.json',
  entryCount: PACK_META.lemmaCount,
  readyCount: PACK_META.learnableCount,
}

export const SAMPLE_PACK: PackMeta = {
  packId: 'tem8-sample-40',
  title: '结构抽样 40 词',
  description: '从已授权 TEM8 可学词中取前 40 条，只用于验证课程架构。这不是美国英语频率表，不得标成 Core 1000。',
  dialect: 'en-GB-source / en-US-speech',
  level: 'sample',
  categories: ['sample'],
  version: '1.0.0',
  source: PACK_META.sourceRepo,
  sourceRevision: PACK_META.sourceFile,
  license: PACK_META.dataLicense,
  attribution: PACK_META.attribution,
  sha256: 'derived-from-tem8-learnable-prefix',
  entryCount: 40,
  readyCount: 40,
}

export const SAMPLE_WORD_IDS = SAMPLE_WORDS.map((word) => word.id)

export const PACKS: PackMeta[] = [TEM8_PACK, SAMPLE_PACK]

export const CORE_FREQUENCY_STATUS =
  'DEFERRED：在取得可再分发的频率来源并完成哈希核验前，不标记 Core 1000/3000/5000。'

export function wordIdsForPack(packId: string): string[] {
  if (packId === SAMPLE_PACK.packId) return SAMPLE_WORD_IDS
  if (WORDS.length === PACK_META.learnableCount) return WORDS.map((word) => word.id)
  return PACK_INDEX.map((entry) => entry.id)
}

export function chapterWordIds(chapter: number): string[] {
  const source = WORDS.length === PACK_META.learnableCount ? WORDS : PACK_INDEX
  return source.filter((word) => word.chapter === chapter).map((word) => word.id)
}

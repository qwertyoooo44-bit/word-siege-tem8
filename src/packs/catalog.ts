import { PACK_META, WORDS } from '../data/pack'
import type { PackMeta } from './types'

export const TEM8_PACK: PackMeta = {
  packId: PACK_META.packId,
  title: PACK_META.title,
  description: PACK_META.notice,
  dialect: 'en-GB-source / en-US-speech',
  level: 'TEM8',
  categories: ['academic', 'tem8'],
  version: '1.0.0',
  source: PACK_META.sourceRepo,
  sourceRevision: PACK_META.sourceFile,
  license: PACK_META.dataLicense,
  attribution: PACK_META.attribution,
  sha256: 'see docs/DATA_SOURCE.md',
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

export const SAMPLE_WORD_IDS = WORDS.slice(0, 40).map((word) => word.id)

export const PACKS: PackMeta[] = [TEM8_PACK, SAMPLE_PACK]

export const CORE_FREQUENCY_STATUS =
  'DEFERRED：在取得可再分发的频率来源并完成哈希核验前，不标记 Core 1000/3000/5000。'

export function wordIdsForPack(packId: string): string[] {
  if (packId === SAMPLE_PACK.packId) return SAMPLE_WORD_IDS
  return WORDS.map((word) => word.id)
}

export function chapterWordIds(chapter: number): string[] {
  return WORDS.filter((word) => word.chapter === chapter).map((word) => word.id)
}

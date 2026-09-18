import type { PersistV2 } from '../engine/types'
import type { DailyStat, WordRecord } from '../review/schedule'

export const BACKUP_VERSION = 2 as const

export type BackupFile = {
  v: typeof BACKUP_VERSION
  app: 'word-siege-tem8'
  exportedAt: number
  persist: PersistV2
  words: WordRecord[]
  daily: DailyStat[]
}

export type BackupCheck =
  | { ok: true; data: BackupFile }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

export function validateBackup(raw: unknown): BackupCheck {
  if (!isRecord(raw)) return { ok: false, error: '文件不是 JSON 对象。' }
  if (raw.app !== 'word-siege-tem8') return { ok: false, error: '不是本应用的备份文件。' }
  if (raw.v !== 1 && raw.v !== 2) return { ok: false, error: '备份版本不受支持。' }
  if (!isRecord(raw.persist)) return { ok: false, error: '缺少学习进度。' }
  if (!Array.isArray(raw.words)) return { ok: false, error: '缺少词状态列表。' }
  const persist = raw.persist as PersistV2
  if (typeof persist.wordIndex !== 'number' || typeof persist.stage !== 'string') {
    return { ok: false, error: '学习进度字段无效。' }
  }
  const words: WordRecord[] = []
  for (const item of raw.words) {
    if (!isRecord(item) || typeof item.wordId !== 'string' || typeof item.word !== 'string') {
      return { ok: false, error: '词状态字段无效，未写入。' }
    }
    words.push(item as unknown as WordRecord)
  }
  const daily = Array.isArray(raw.daily) ? (raw.daily as DailyStat[]) : []
  return {
    ok: true,
    data: {
      v: 2,
      app: 'word-siege-tem8',
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : Date.now(),
      persist,
      words,
      daily,
    },
  }
}

export function parseBackupText(text: string): BackupCheck {
  try {
    return validateBackup(JSON.parse(text))
  } catch {
    return { ok: false, error: '无法解析 JSON。' }
  }
}

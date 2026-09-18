import { WORDS as TEST_WORDS } from '../data/pack'
import { fromPersist, toPersist } from '../engine/machine'
import type { EngineState, PersistState, PersistV2 } from '../engine/types'
import {
  counts,
  dateKey,
  dueReviews,
  failReview,
  markDue,
  passReview,
  scheduleAfterMastery,
  type DailyStat,
  type WordRecord,
} from '../review/schedule'
import { parseBackupText, type BackupFile } from './backup'
import { db, SCHEMA_VERSION } from './database'

function blankRecord(wordId: string, word: string): WordRecord {
  return {
    wordId,
    word,
    status: 'new',
    reviewKind: null,
    nextReviewAt: null,
    masteredAt: null,
    longMasteredAt: null,
  }
}

export async function ensureSeed(): Promise<void> {
  await db.meta.put({ id: 'app', schemaVersion: SCHEMA_VERSION })
  const existing = await db.words.count()
  if (existing > 0) return
  const rows = TEST_WORDS.map((w) => blankRecord(w.id, w.word))
  const chunk = 500
  for (let i = 0; i < rows.length; i += chunk) {
    await db.words.bulkAdd(rows.slice(i, i + chunk))
  }
}

export async function loadAllRecords(): Promise<WordRecord[]> {
  await ensureSeed()
  return db.words.toArray()
}

export async function saveCurrent(state: EngineState): Promise<void> {
  await db.current.put({ id: 'siege', persist: toPersist(state) })
}

export async function loadCurrent(): Promise<EngineState | null> {
  const row = await db.current.get('siege')
  if (!row?.persist) return null
  return fromPersist(row.persist)
}

export async function upsertWord(record: WordRecord): Promise<void> {
  await db.words.put(record)
}

export async function onWordMastered(state: EngineState, at = Date.now()): Promise<WordRecord> {
  const word = TEST_WORDS[state.wordIndex]
  if (!word?.learnable) {
    throw new Error('incomplete word cannot be mastered')
  }
  const prev = (await db.words.get(word.id)) ?? blankRecord(word.id, word.word)
  const next =
    state.mode === 'review' && prev.reviewKind
      ? passReview(prev, at)
      : scheduleAfterMastery(prev, at)
  await db.words.put(next)
  await bumpDaily(at, {
    wordsMastered: state.mode === 'learn' ? 1 : 0,
    reviewsDone: state.mode === 'review' ? 1 : 0,
  })
  return next
}

export async function onReviewFailed(wordId: string): Promise<WordRecord | null> {
  const prev = await db.words.get(wordId)
  if (!prev) return null
  const next = failReview(prev)
  await db.words.put(next)
  return next
}

export async function bumpDaily(
  at: number,
  delta: Partial<Pick<DailyStat, 'wordsMastered' | 'reviewsDone' | 'studyMs' | 'charCorrect' | 'charWrong'>>,
): Promise<void> {
  const date = dateKey(at)
  const prev = (await db.daily.get(date)) ?? {
    date,
    wordsMastered: 0,
    reviewsDone: 0,
    studyMs: 0,
    charCorrect: 0,
    charWrong: 0,
  }
  await db.daily.put({
    date,
    wordsMastered: prev.wordsMastered + (delta.wordsMastered ?? 0),
    reviewsDone: prev.reviewsDone + (delta.reviewsDone ?? 0),
    studyMs: prev.studyMs + (delta.studyMs ?? 0),
    charCorrect: prev.charCorrect + (delta.charCorrect ?? 0),
    charWrong: prev.charWrong + (delta.charWrong ?? 0),
  })
}

export async function snapshot(state: EngineState): Promise<BackupFile> {
  const words = await db.words.toArray()
  const daily = await db.daily.toArray()
  return {
    v: 2,
    app: 'word-siege-tem8',
    exportedAt: Date.now(),
    persist: toPersist(state),
    words,
    daily,
  }
}

export async function importBackup(text: string, confirmOverwrite: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = parseBackupText(text)
  if (!check.ok) return check
  if (!confirmOverwrite) return { ok: false, error: '需要确认后才能覆盖本地数据。' }
  const current = await db.current.get('siege')
  const words = await db.words.toArray()
  const daily = await db.daily.toArray()
  try {
    await db.transaction('rw', db.current, db.words, db.daily, db.meta, async () => {
      await db.current.clear()
      await db.words.clear()
      await db.daily.clear()
      await db.meta.put({ id: 'app', schemaVersion: SCHEMA_VERSION })
      await db.current.put({ id: 'siege', persist: check.data.persist })
      if (check.data.words.length) await db.words.bulkAdd(check.data.words)
      if (check.data.daily.length) await db.daily.bulkAdd(check.data.daily)
    })
    return { ok: true }
  } catch {
    await db.transaction('rw', db.current, db.words, db.daily, async () => {
      await db.current.clear()
      await db.words.clear()
      await db.daily.clear()
      if (current) await db.current.put(current)
      if (words.length) await db.words.bulkAdd(words)
      if (daily.length) await db.daily.bulkAdd(daily)
    })
    return { ok: false, error: '导入失败，原数据已保留。' }
  }
}

export async function clearLearningData(): Promise<void> {
  await db.transaction('rw', db.current, db.words, db.daily, async () => {
    await db.current.clear()
    await db.words.clear()
    await db.daily.clear()
  })
  await ensureSeed()
}

export async function homeStats(at = Date.now()) {
  const records = markDue(await loadAllRecords(), at)
  await db.words.bulkPut(records)
  const c = counts(records, at)
  const due = dueReviews(records, at)
  const errors = records.filter((record) => record.status === 'siege')
  const today = await db.daily.get(dateKey(at))
  return { ...c, dueList: due, errorList: errors, todayMastered: today?.wordsMastered ?? 0 }
}

export function migrateLocalStorage(raw: string | null): PersistV2 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistState
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null
    return toPersist(fromPersist(parsed))
  } catch {
    return null
  }
}

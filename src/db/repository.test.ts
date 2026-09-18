import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialState, fromPersist, startReview, toPersist, typeChar } from '../engine/machine'
import { parseBackupText } from './backup'
import { db } from './database'
import {
  clearLearningData,
  ensureSeed,
  homeStats,
  importBackup,
  loadCurrent,
  migrateLocalStorage,
  onReviewFailed,
  onWordMastered,
  saveCurrent,
  snapshot,
} from './repository'

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('indexeddb repository', () => {
  it('seeds the official word list and restores current siege', async () => {
    await ensureSeed()
    const state = createInitialState({ wordIndex: 3, stage: 'chinese', consecutiveCorrect: 1 })
    await saveCurrent(state)
    const loaded = await loadCurrent()
    expect(loaded?.wordIndex).toBe(3)
    expect(loaded?.stage).toBe('chinese')
    const stats = await homeStats()
    expect(stats.total).toBe(3826)
    expect(stats.fresh).toBe(3826)
  })

  it('migrates localStorage v1 into persist v2', () => {
    const v1 = JSON.stringify({
      v: 1,
      wordIndex: 2,
      stage: 'listen',
      consecutiveCorrect: 1,
      usedHintThisAttempt: false,
      helpLevel: 0,
      attempts: 4,
      charCorrect: 8,
      charWrong: 1,
      errors: 1,
      startedAt: 99,
      motion: 'calm',
      soundEnabled: true,
      speechEnabled: true,
      allDone: false,
    })
    const migrated = migrateLocalStorage(v1)
    expect(migrated?.v).toBe(2)
    expect(fromPersist(migrated!).stage).toBe('listen')
    expect(fromPersist(migrated!).wordIndex).toBe(2)
  })

  it('rejects invalid JSON import and keeps original rows', async () => {
    await ensureSeed()
    await saveCurrent(createInitialState({ wordIndex: 1 }))
    const bad = await importBackup('{not-json', true)
    expect(bad.ok).toBe(false)
    const still = await loadCurrent()
    expect(still?.wordIndex).toBe(1)
  })

  it('requires confirm before overwrite and can round-trip a valid backup', async () => {
    await ensureSeed()
    const state = createInitialState({ wordIndex: 5, stage: 'copy' })
    await saveCurrent(state)
    const file = await snapshot(state)
    const text = JSON.stringify(file)
    expect(parseBackupText(text).ok).toBe(true)
    const denied = await importBackup(text, false)
    expect(denied.ok).toBe(false)
    await clearLearningData()
    const ok = await importBackup(text, true)
    expect(ok.ok).toBe(true)
    const loaded = await loadCurrent()
    expect(loaded?.wordIndex).toBe(5)
  })

  it('records mastery then failed review without mixing another word', async () => {
    await ensureSeed()
    const mastered = createInitialState({ wordIndex: 0, stage: 'mastered', mode: 'learn' })
    const rec = await onWordMastered(mastered, Date.parse('2026-09-01'))
    expect(rec.reviewKind).toBe(1)
    const failed = await onReviewFailed('tem8-0001')
    expect(failed?.status).toBe('siege')
    const review = startReview(createInitialState({ learnIndex: 1 }), 0)
    expect(review.mode).toBe('review')
    expect(review.wordIndex).toBe(0)
    expect(review.learnIndex).toBe(1)
    expect(typeChar(review, 'z').next.stage).toBe('copy')
    expect(typeChar(review, 'z').next.wordIndex).toBe(0)
  })
})

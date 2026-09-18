import { describe, expect, it } from 'vitest'
import {
  addDays,
  dueReviews,
  failReview,
  passReview,
  scheduleAfterMastery,
  startOfDay,
  type WordRecord,
} from './schedule'

const base: WordRecord = {
  wordId: 'test-01',
  word: 'albeit',
  status: 'new',
  reviewKind: null,
  nextReviewAt: null,
  masteredAt: null,
  longMasteredAt: null,
}

describe('review schedule', () => {
  it('schedules day 1, 3 and 7 from mastery and never mixes words', () => {
    const t0 = Date.parse('2026-09-01T12:00:00')
    let rec = scheduleAfterMastery(base, t0)
    expect(rec.status).toBe('mastered')
    expect(rec.reviewKind).toBe(1)
    expect(rec.nextReviewAt).toBe(addDays(t0, 1))
    expect(dueReviews([rec], t0)).toHaveLength(0)
    expect(dueReviews([rec], addDays(t0, 1))).toHaveLength(1)

    rec = passReview(rec, addDays(t0, 1))
    expect(rec.reviewKind).toBe(3)
    expect(rec.nextReviewAt).toBe(addDays(t0, 3))
    rec = passReview(rec, addDays(t0, 3))
    expect(rec.reviewKind).toBe(7)
    rec = passReview(rec, addDays(t0, 7))
    expect(rec.status).toBe('long')
    expect(rec.nextReviewAt).toBeNull()
    expect(dueReviews([rec], addDays(t0, 30))).toHaveLength(0)
  })

  it('failed review returns the same word to full siege', () => {
    const rec = failReview(scheduleAfterMastery(base, Date.now()))
    expect(rec.status).toBe('siege')
    expect(rec.nextReviewAt).toBeNull()
    expect(rec.day1).toBe('fail')
  })

  it('due list is ordered one-word work, not shuffled', () => {
    const t0 = startOfDay(Date.parse('2026-09-10'))
    const a = scheduleAfterMastery({ ...base, wordId: 'a', word: 'alpha' }, addDays(t0, -3))
    const b = scheduleAfterMastery({ ...base, wordId: 'b', word: 'bravo' }, addDays(t0, -1))
    const due = dueReviews([a, b], t0)
    expect(due.map((x) => x.wordId)).toEqual(['a', 'b'])
  })
})

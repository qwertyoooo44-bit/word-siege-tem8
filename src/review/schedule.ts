export type WordStatus = 'new' | 'siege' | 'mastered' | 'due' | 'long'

export type ReviewKind = 1 | 3 | 7

export type WordRecord = {
  wordId: string
  word: string
  status: WordStatus
  reviewKind: ReviewKind | null
  nextReviewAt: number | null
  masteredAt: number | null
  longMasteredAt: number | null
  day1?: 'pending' | 'pass' | 'fail'
  day3?: 'pending' | 'pass' | 'fail'
  day7?: 'pending' | 'pass' | 'fail'
}

export type DailyStat = {
  date: string
  wordsMastered: number
  reviewsDone: number
  studyMs: number
  charCorrect: number
  charWrong: number
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  const d = new Date(startOfDay(ts))
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function dateKey(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function dueReviews(records: WordRecord[], at: number): WordRecord[] {
  return records.filter((r) => {
    if (r.status === 'long') return false
    if (r.nextReviewAt == null) return false
    return r.nextReviewAt <= startOfDay(at) || r.status === 'due'
  })
}

export function scheduleAfterMastery(record: WordRecord, at: number): WordRecord {
  return {
    ...record,
    status: 'mastered',
    masteredAt: at,
    reviewKind: 1,
    nextReviewAt: addDays(at, 1),
    day1: 'pending',
    day3: undefined,
    day7: undefined,
    longMasteredAt: null,
  }
}

export function passReview(record: WordRecord, at: number): WordRecord {
  const kind = record.reviewKind ?? 1
  if (kind === 1) {
    return {
      ...record,
      status: 'mastered',
      reviewKind: 3,
      nextReviewAt: addDays(record.masteredAt ?? at, 3),
      day1: 'pass',
      day3: 'pending',
    }
  }
  if (kind === 3) {
    return {
      ...record,
      status: 'mastered',
      reviewKind: 7,
      nextReviewAt: addDays(record.masteredAt ?? at, 7),
      day3: 'pass',
      day7: 'pending',
    }
  }
  return {
    ...record,
    status: 'long',
    reviewKind: null,
    nextReviewAt: null,
    day7: 'pass',
    longMasteredAt: at,
  }
}

export function failReview(record: WordRecord): WordRecord {
  const kind = record.reviewKind
  return {
    ...record,
    status: 'siege',
    nextReviewAt: null,
    reviewKind: null,
    day1: kind === 1 ? 'fail' : record.day1,
    day3: kind === 3 ? 'fail' : record.day3,
    day7: kind === 7 ? 'fail' : record.day7,
  }
}

export function markDue(records: WordRecord[], at: number): WordRecord[] {
  const today = startOfDay(at)
  return records.map((r) => {
    if (r.status === 'long' || r.nextReviewAt == null) return r
    if (r.nextReviewAt <= today && (r.status === 'mastered' || r.status === 'due')) {
      return { ...r, status: 'due' as const }
    }
    return r
  })
}

export function counts(records: WordRecord[], at: number) {
  const due = dueReviews(records, at).length
  const mastered = records.filter((r) => r.status === 'mastered' || r.status === 'due' || r.status === 'long').length
  const long = records.filter((r) => r.status === 'long').length
  const siege = records.filter((r) => r.status === 'siege').length
  const fresh = records.filter((r) => r.status === 'new').length
  return { due, mastered, long, siege, fresh, total: records.length }
}

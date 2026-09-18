import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/pack'
import { SAMPLE_PACK, SAMPLE_WORD_IDS, TEM8_PACK, wordIdsForPack } from '../packs/catalog'
import { parseCourseTable } from './parse'
import { courseProgress, firstCourseCatalogIndex, masteredWordIds, nextCourseCatalogIndex } from './queue'

describe('course packs', () => {
  it('keeps TEM8 as the only full learnable pack and sample as architecture check', () => {
    expect(TEM8_PACK.readyCount).toBe(3826)
    expect(SAMPLE_PACK.readyCount).toBe(40)
    expect(SAMPLE_WORD_IDS).toHaveLength(40)
    expect(SAMPLE_WORD_IDS[0]).toBe(WORDS[0].id)
    expect(wordIdsForPack(TEM8_PACK.packId)).toHaveLength(3826)
  })

  it('maps a course to catalog indexes without rewriting the siege queue', () => {
    const ids = [WORDS[0].id, WORDS[5].id, WORDS[8].id]
    expect(firstCourseCatalogIndex(ids)).toBe(0)
    expect(nextCourseCatalogIndex(ids, WORDS[0].id)).toBe(5)
    expect(nextCourseCatalogIndex(ids, WORDS[8].id)).toBeNull()
  })

  it('imports only words that already exist in the licensed pack', () => {
    const parsed = parseCourseTable('word\nabacus\nnot-a-real-lexeme\nabacus\n')
    expect(parsed.wordIds).toEqual([WORDS[0].id])
    expect(parsed.unknown).toContain('not-a-real-lexeme')
  })

  it('counts course mastery by stable wordId rather than learnIndex', () => {
    const ids = [WORDS[0].id, WORDS[5].id, WORDS[8].id]
    const mastered = masteredWordIds([
      { wordId: WORDS[5].id, word: WORDS[5].word, status: 'mastered', reviewKind: 1, nextReviewAt: 1, masteredAt: 1, longMasteredAt: null },
      { wordId: WORDS[0].id, word: WORDS[0].word, status: 'new', reviewKind: null, nextReviewAt: null, masteredAt: null, longMasteredAt: null },
    ])
    expect(courseProgress(ids, mastered)).toEqual({ done: 1, total: 3 })
  })
})

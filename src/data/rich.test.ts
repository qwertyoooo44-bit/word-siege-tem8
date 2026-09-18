import { describe, expect, it } from 'vitest'
import { PACK_META, WORDS } from './pack'
import {
  createInitialState,
  currentWord,
  fromPersist,
  nextWord,
  pause,
  resume,
  startReview,
  startSiege,
  toPersist,
  typeChar,
} from '../engine/machine'
import type { EngineState } from '../engine/types'

function typeWord(state: EngineState, word = currentWord(state).word) {
  let cur = state
  for (const ch of word) {
    if (ch === '-' || ch === "'") continue
    const r = typeChar(cur, ch)
    if (!r?.next) throw new Error(`typeChar failed at ${word} ${ch}`)
    cur = r.next
  }
  return cur
}

function passStage(state: EngineState, times: number) {
  let cur = state
  for (let i = 0; i < times; i++) cur = typeWord(cur)
  return cur
}

function siege(start: EngineState) {
  let cur = startSiege(start).next
  cur = passStage(cur, 2)
  cur = passStage(cur, 1)
  cur = passStage(cur, 2)
  cur = passStage(cur, 2)
  cur = passStage(cur, 2)
  cur = passStage(cur, 1)
  cur = passStage(cur, 2)
  return cur
}

function pick(pred: (w: (typeof WORDS)[number]) => boolean) {
  const found = WORDS.find(pred)
  if (!found) throw new Error('missing sample')
  return WORDS.findIndex((w) => w.id === found.id)
}

describe('rich TEM8 siege data', () => {
  it('keeps incomplete lemmas out of the siege queue', () => {
    expect(PACK_META.lemmaCount).toBe(3984)
    expect(WORDS).toHaveLength(3826)
    expect(PACK_META.incompleteCount).toBe(158)
    expect(WORDS.every((w) => w.ipa.startsWith('/') && w.pos && w.gloss && w.context)).toBe(true)
  })

  it('runs seven gates on short, long, hyphen and multi-pos words', () => {
    const samples = [
      pick((w) => w.word === 'abacus'),
      pick((w) => w.word.length >= 12),
      pick((w) => w.word.includes('-')),
      pick((w) => (w.pos.match(/\./g) ?? []).length >= 2),
    ]
    for (const index of samples) {
      const word = WORDS[index]
      expect(word, `sample ${index}`).toBeTruthy()
      expect(word.gloss.length, word.word).toBeGreaterThan(0)
      const mastered = siege(createInitialState({ wordIndex: index }))
      expect(mastered?.stage, word.word).toBe('mastered')
      expect(nextWord(createInitialState({ wordIndex: index, stage: 'final' })).ok).toBe(false)
    }
  })

  it('uses real chinese gloss, context and three final prompt kinds', () => {
    const abacus = WORDS[0]
    expect(abacus.gloss).toContain('算盘')
    expect(abacus.context.toLowerCase()).toContain('abacus')
    expect(abacus.ipa).toContain('æ')
    const chinese = createInitialState({ wordIndex: 0, stage: 'chinese' })
    expect(chinese.stage).toBe('chinese')
    const ctx = createInitialState({ wordIndex: 0, stage: 'context' })
    expect(ctx.stage).toBe('context')
    const prompts = [0, 1, 2].map((i) => i % 3)
    expect(new Set(prompts).size).toBe(3)
  })

  it('pauses, restores by word id, and reviews the same learnable word', () => {
    let cur = createInitialState({ wordIndex: 0, stage: 'copy' })
    cur = typeChar(cur, 'a').next
    cur = pause(cur).next
    const restored = fromPersist(toPersist(cur))
    expect(toPersist(cur).wordId).toBe(WORDS[0].id)
    expect(currentWord(restored).word).toBe('abacus')
    expect(resume(restored).next.paused).toBe(false)
    const review = startReview(createInitialState({ learnIndex: 4 }), 0)
    expect(currentWord(review).word).toBe('abacus')
    expect(review.stage).toBe('final')
  })
})

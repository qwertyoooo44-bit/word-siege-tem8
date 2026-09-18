import { describe, expect, it } from 'vitest'
import { PACK_META, WORDS as TEST_WORDS } from '../data/pack'
import {
  accuracy,
  blockPaste,
  canAdvanceWord,
  createInitialState,
  currentWord,
  elapsedMs,
  fromPersist,
  nextWord,
  pause,
  requestHint,
  resume,
  sessionWpm,
  setMotion,
  settlement,
  startReview,
  startSiege,
  toPersist,
  typeChar,
  wpm,
} from './machine'
import type { EngineState, PersistV1, StageId } from './types'

function typeWord(state: EngineState, word = currentWord(state).word) {
  let cur = state
  const events = []
  for (const ch of word) {
    const r = typeChar(cur, ch)
    events.push(...r.events)
    cur = r.next
  }
  return { next: cur, events }
}

function passStage(state: EngineState, times: number) {
  let cur = state
  for (let i = 0; i < times; i++) {
    cur = typeWord(cur).next
  }
  return cur
}

function runSevenGates(start: EngineState) {
  let cur = start
  expect(cur.stage).toBe('understand')
  cur = startSiege(cur).next
  expect(cur.stage).toBe('copy')
  cur = passStage(cur, 2)
  expect(cur.stage).toBe('fadePartial')
  cur = passStage(cur, 1)
  expect(cur.stage).toBe('fadeHidden')
  cur = passStage(cur, 2)
  expect(cur.stage).toBe('chinese')
  cur = passStage(cur, 2)
  expect(cur.stage).toBe('listen')
  cur = passStage(cur, 2)
  expect(cur.stage).toBe('context')
  cur = passStage(cur, 1)
  expect(cur.stage).toBe('final')
  cur = passStage(cur, 2)
  expect(cur.stage).toBe('mastered')
  return cur
}

describe('phase2 siege engine', () => {
  it('uses the official learnable TEM8 queue', () => {
    expect(TEST_WORDS).toHaveLength(PACK_META.learnableCount)
    expect(PACK_META.lemmaCount).toBe(3984)
    expect(PACK_META.learnableCount).toBe(3826)
    expect(TEST_WORDS.every((w) => w.learnable)).toBe(true)
  })

  it('completes all seven gates on one word before unlocking the next', () => {
    const mastered = runSevenGates(createInitialState())
    expect(canAdvanceWord(mastered)).toBe(true)
    expect(nextWord(createInitialState()).ok).toBe(false)
    expect(nextWord({ ...createInitialState(), stage: 'final' }).ok).toBe(false)
    const advanced = nextWord(mastered)
    expect(advanced.ok).toBe(true)
    expect(advanced.next.wordIndex).toBe(1)
    expect(advanced.next.stage).toBe('understand')
    expect(advanced.next.session.wordsMastered).toBe(1)
    expect(advanced.next.session.masteredWords).toEqual(['abacus'])
  })

  it('does not count hinted input as unprompted consecutive correct', () => {
    let cur = createInitialState({ stage: 'chinese' })
    cur = requestHint(cur, 'ipa').next
    expect(cur.usedHintThisAttempt).toBe(true)
    cur = typeWord(cur).next
    expect(cur.stage).toBe('chinese')
    expect(cur.consecutiveCorrect).toBe(0)
    expect(cur.usedHintThisAttempt).toBe(false)
    expect(cur.message).toContain('不计入')
    cur = typeWord(cur).next
    expect(cur.consecutiveCorrect).toBe(1)
    cur = typeWord(cur).next
    expect(cur.stage).toBe('listen')
  })

  it('restores word, stage, typed prefix and settings after persist', () => {
    const saved = createInitialState({
      wordIndex: 4,
      stage: 'listen',
      typed: 'meti',
      consecutiveCorrect: 1,
      motion: 'vivid',
      soundEnabled: false,
      speechEnabled: true,
      attempts: 9,
      stageAttempts: 2,
    })
    const restored = fromPersist(toPersist(saved))
    expect(restored.wordIndex).toBe(4)
    expect(restored.stage).toBe('listen')
    expect(restored.typed).toBe('meti')
    expect(restored.consecutiveCorrect).toBe(1)
    expect(restored.motion).toBe('vivid')
    expect(restored.soundEnabled).toBe(false)
    expect(currentWord(restored).word).toBe(TEST_WORDS[4].word)
  })

  it('migrates v1 persist without dropping the current word', () => {
    const v1: PersistV1 = {
      v: 1,
      wordIndex: 2,
      stage: 'fadeHidden',
      consecutiveCorrect: 1,
      usedHintThisAttempt: false,
      helpLevel: 0,
      attempts: 3,
      charCorrect: 10,
      charWrong: 1,
      errors: 1,
      startedAt: 1,
      motion: 'off',
      soundEnabled: true,
      speechEnabled: true,
      allDone: false,
    }
    const restored = fromPersist(v1)
    expect(restored.wordIndex).toBe(2)
    expect(restored.stage).toBe('fadeHidden')
    expect(currentWord(restored).word).toBe(TEST_WORDS[2].word)
  })

  it('supports three motion levels and never auto-passes after mistakes', () => {
    expect(setMotion(createInitialState(), 'off').motion).toBe('off')
    expect(setMotion(createInitialState(), 'calm').motion).toBe('calm')
    expect(setMotion(createInitialState(), 'vivid').motion).toBe('vivid')
    let cur = createInitialState({ stage: 'copy' })
    for (let i = 0; i < 8; i++) cur = typeChar(cur, 'z').next
    expect(cur.stage).toBe('copy')
    expect(canAdvanceWord(cur)).toBe(false)
    expect(cur.helpLevel).toBeGreaterThan(0)
  })

  it('blocks paste completion and keeps the correct prefix on a typo', () => {
    let cur = createInitialState({ stage: 'copy' })
    const w = currentWord(cur).word
    cur = typeChar(cur, w[0]!).next
    cur = typeChar(cur, w[1]!).next
    const wrong = typeChar(cur, 'x')
    expect(wrong.next.typed).toBe(w.slice(0, 2))
    expect(wrong.events.some((e) => e.type === 'letter-bad')).toBe(true)
    const paste = blockPaste(cur)
    expect(paste.events[0]?.type).toBe('paste-blocked')
    expect(paste.next.stage).toBe('copy')
  })

  it('escalates help on consecutive mistakes and still requires unprompted success', () => {
    let cur = createInitialState({ stage: 'chinese' })
    cur = typeChar(cur, 'z').next
    expect(cur.helpLevel).toBe(0)
    const second = typeChar(cur, 'z')
    expect(second.events.some((e) => e.type === 'help')).toBe(true)
    cur = second.next
    expect(cur.usedHintThisAttempt).toBe(true)
    cur = typeWord(cur).next
    expect(cur.stage).toBe('chinese')
    expect(cur.consecutiveCorrect).toBe(0)
  })

  it('pauses typing and freezes elapsed time until resume', () => {
    let cur = createInitialState({ stage: 'copy', startedAt: 1_000, accumulatedMs: 0 })
    cur = pause(cur, 4_000).next
    expect(cur.paused).toBe(true)
    expect(elapsedMs(cur, 9_000)).toBe(3_000)
    expect(typeChar(cur, 'a').next.typed).toBe('')
    cur = resume(cur, 20_000).next
    expect(cur.paused).toBe(false)
    expect(elapsedMs(cur, 21_000)).toBe(4_000)
    expect(typeChar(cur, 'a').next.typed).toBe('a')
  })

  it('keeps WPM as typing stats and never uses it to mark mastery', () => {
    const fast = createInitialState({
      stage: 'copy',
      charCorrect: 500,
      startedAt: 1,
      accumulatedMs: 1000,
    })
    expect(wpm(fast, 1)).toBeGreaterThan(0)
    expect(fast.stage).toBe('copy')
    expect(canAdvanceWord(fast)).toBe(false)
    const settled = settlement(fast, 1)
    expect(settled.wpm).toBe(sessionWpm(fast, 1))
    expect(settled.unfinished).toBe(TEST_WORDS[0].word)
    expect(settled.nextReviewLabel).toContain('阶段3')
  })

  it('builds a session settlement after a mastered word', () => {
    const mastered = runSevenGates(createInitialState())
    const card = settlement(mastered)
    expect(card.wordsMastered).toBe(1)
    expect(card.masteredWords).toEqual([TEST_WORDS[0].word])
    expect(card.unfinished).toBeNull()
    expect(card.accuracy).toBe(100)
    expect(card.longMastered).toBe(0)
  })

  it('allows replay on listen without counting as a spelling hint', () => {
    const listen = requestHint(createInitialState({ stage: 'listen' }), 'speech')
    expect(listen.next.usedHintThisAttempt).toBe(false)
    expect(listen.events.some((e) => e.type === 'speech-replay')).toBe(true)
    const copy = requestHint(createInitialState({ stage: 'copy' }), 'speech')
    expect(copy.next.usedHintThisAttempt).toBe(true)
  })

  it('reports accuracy from typed stats only, not as mastery', () => {
    let cur = createInitialState({ stage: 'context' })
    cur = typeChar(cur, 'x').next
    cur = typeWord(cur).next
    expect(cur.stage).toBe('final')
    expect(accuracy(cur)).toBeLessThan(100)
    expect(cur.stage).not.toBe('mastered')
  })

  it('reviews one due word and failed review restarts the same word', () => {
    const review = startReview(createInitialState({ learnIndex: 2 }), 0)
    expect(review.mode).toBe('review')
    expect(review.stage).toBe('final')
    expect(review.wordIndex).toBe(0)
    const failed = typeChar(review, 'z').next
    expect(failed.stage).toBe('copy')
    expect(failed.wordIndex).toBe(0)
    expect(nextWord(failed).ok).toBe(false)
    const passed = passStage(failed, 2 + 1 + 2 + 2 + 2 + 1 + 2)
    expect(passed.stage).toBe('mastered')
    const back = nextWord(passed)
    expect(back.ok).toBe(true)
    expect(back.next.mode).toBe('learn')
    expect(back.next.wordIndex).toBe(2)
  })

  it('walks stage ids in the required siege order', () => {
    const order: StageId[] = [
      'understand',
      'copy',
      'fadePartial',
      'fadeHidden',
      'chinese',
      'listen',
      'context',
      'final',
      'mastered',
    ]
    let cur = createInitialState()
    const seen: StageId[] = [cur.stage]
    cur = startSiege(cur).next
    seen.push(cur.stage)
    const need = [2, 1, 2, 2, 2, 1, 2]
    for (const n of need) {
      cur = passStage(cur, n)
      seen.push(cur.stage)
    }
    expect(seen).toEqual(order)
  })
})

import { catalogIndexToQueue, WORDS as TEST_WORDS, type PackWord as TestWord } from '../data/pack'
import type {
  EngineEvent,
  EngineState,
  FinalPrompt,
  HelpKind,
  LetterErrors,
  PersistState,
  PersistV2,
  SessionStats,
  Settlement,
  StageId,
} from './types'

const STAGE_ORDER: StageId[] = [
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

const REQUIRED: Record<Exclude<StageId, 'understand' | 'mastered'>, number> = {
  copy: 2,
  fadePartial: 1,
  fadeHidden: 2,
  chinese: 2,
  listen: 2,
  context: 1,
  final: 2,
}

const HELP_STEPS: HelpKind[] = ['speech', 'ipa', 'syllable', 'root', 'flash', 'restart']

function now() {
  return Date.now()
}

function emptyErrors(): LetterErrors {
  return {}
}

function bumpError(map: LetterErrors, letter: string): LetterErrors {
  const key = letter.toLowerCase()
  return { ...map, [key]: (map[key] ?? 0) + 1 }
}

function emptySession(at = now()): SessionStats {
  return {
    wordsMastered: 0,
    reviewsDone: 0,
    charCorrect: 0,
    charWrong: 0,
    startedAt: at,
    accumulatedMs: 0,
    letterErrors: emptyErrors(),
    masteredWords: [],
  }
}

export function currentWord(state: EngineState): TestWord {
  return TEST_WORDS[state.wordIndex] ?? TEST_WORDS[0]
}

export function createInitialState(partial?: Partial<EngineState>): EngineState {
  const at = now()
  return {
    wordIndex: 0,
    stage: 'understand',
    typed: '',
    consecutiveCorrect: 0,
    usedHintThisAttempt: false,
    consecutiveMistakes: 0,
    helpLevel: 0,
    showIpa: true,
    showSyllable: false,
    showRoot: true,
    showInitial: false,
    flashWordUntil: 0,
    attempts: 0,
    stageAttempts: 0,
    charCorrect: 0,
    charWrong: 0,
    errors: 0,
    letterErrors: emptyErrors(),
    startedAt: at,
    accumulatedMs: 0,
    paused: false,
    pauseStartedAt: null,
    masteredAt: null,
    motion: 'calm',
    soundEnabled: true,
    speechEnabled: true,
    allDone: false,
    message: '',
    session: emptySession(at),
    mode: 'learn',
    learnIndex: 0,
    reviewWordId: null,
    ...partial,
  }
}

export function toPersist(state: EngineState): PersistV2 {
  return {
    v: 2,
    wordIndex: state.wordIndex,
    wordId: currentWord(state).id,
    stage: state.stage,
    typed: state.typed,
    consecutiveCorrect: state.consecutiveCorrect,
    usedHintThisAttempt: state.usedHintThisAttempt,
    helpLevel: state.helpLevel,
    consecutiveMistakes: state.consecutiveMistakes,
    attempts: state.attempts,
    stageAttempts: state.stageAttempts,
    charCorrect: state.charCorrect,
    charWrong: state.charWrong,
    errors: state.errors,
    letterErrors: state.letterErrors,
    startedAt: state.startedAt,
    accumulatedMs: elapsedMs(state),
    paused: state.paused,
    motion: state.motion,
    soundEnabled: state.soundEnabled,
    speechEnabled: state.speechEnabled,
    allDone: state.allDone,
    session: {
      ...state.session,
      accumulatedMs: sessionElapsedMs(state),
    },
    mode: state.mode,
    learnIndex: state.learnIndex,
    reviewWordId: state.reviewWordId,
  }
}

export function fromPersist(raw: PersistState): EngineState {
  const v2: PersistV2 =
    raw.v === 2
      ? raw
      : {
          v: 2,
          wordIndex: raw.wordIndex,
          stage: raw.stage,
          typed: '',
          consecutiveCorrect: raw.consecutiveCorrect,
          usedHintThisAttempt: raw.usedHintThisAttempt,
          helpLevel: raw.helpLevel,
          consecutiveMistakes: 0,
          attempts: raw.attempts,
          stageAttempts: 0,
          charCorrect: raw.charCorrect,
          charWrong: raw.charWrong,
          errors: raw.errors,
          letterErrors: emptyErrors(),
          startedAt: raw.startedAt,
          accumulatedMs: Math.max(0, now() - (raw.startedAt || now())),
          paused: false,
          motion: raw.motion,
          soundEnabled: raw.soundEnabled,
          speechEnabled: raw.speechEnabled,
          allDone: raw.allDone,
          session: emptySession(raw.startedAt || now()),
          mode: 'learn',
          learnIndex: raw.wordIndex,
          reviewWordId: null,
        }
  const stage = STAGE_ORDER.includes(v2.stage) ? v2.stage : 'understand'
  const byId = v2.wordId ? TEST_WORDS.findIndex((w) => w.id === v2.wordId) : -1
  const mapped = byId >= 0 ? byId : catalogIndexToQueue(Math.max(0, v2.wordIndex | 0))
  const wordIndex = Math.min(mapped, Math.max(0, TEST_WORDS.length - 1))
  return createInitialState({
    wordIndex,
    stage,
    typed: String(v2.typed ?? '').toLowerCase().replace(/[^a-z]/g, ''),
    consecutiveCorrect: Math.max(0, v2.consecutiveCorrect | 0),
    usedHintThisAttempt: Boolean(v2.usedHintThisAttempt),
    helpLevel: Math.max(0, v2.helpLevel | 0),
    consecutiveMistakes: Math.max(0, v2.consecutiveMistakes | 0),
    attempts: Math.max(0, v2.attempts | 0),
    stageAttempts: Math.max(0, v2.stageAttempts | 0),
    charCorrect: Math.max(0, v2.charCorrect | 0),
    charWrong: Math.max(0, v2.charWrong | 0),
    errors: Math.max(0, v2.errors | 0),
    letterErrors: v2.letterErrors ?? emptyErrors(),
    startedAt: now(),
    accumulatedMs: Math.max(0, v2.accumulatedMs | 0),
    paused: Boolean(v2.paused) && stage !== 'mastered' && !v2.allDone,
    pauseStartedAt: v2.paused ? now() : null,
    motion: v2.motion === 'off' || v2.motion === 'vivid' ? v2.motion : 'calm',
    soundEnabled: v2.soundEnabled !== false,
    speechEnabled: v2.speechEnabled !== false,
    allDone: Boolean(v2.allDone),
    showIpa: stage === 'understand' || stage === 'copy' || stage === 'fadePartial' || stage === 'fadeHidden',
    showRoot: stage === 'understand',
    session: {
      ...emptySession(v2.session?.startedAt || v2.startedAt || now()),
      ...v2.session,
      letterErrors: v2.session?.letterErrors ?? emptyErrors(),
      masteredWords: v2.session?.masteredWords ?? [],
    },
    message: v2.allDone ? '全部测试词已攻克。' : v2.paused ? '已暂停。' : '',
    mode: v2.mode === 'review' ? 'review' : 'learn',
    learnIndex: Math.min(Math.max(0, (v2.learnIndex ?? v2.wordIndex) | 0), TEST_WORDS.length - 1),
    reviewWordId: v2.reviewWordId ?? null,
  })
}

export function canAdvanceWord(state: EngineState): boolean {
  return state.stage === 'mastered'
}

export function accuracy(state: EngineState): number {
  const total = state.charCorrect + state.charWrong
  if (total === 0) return 100
  return Math.round((state.charCorrect / total) * 100)
}

export function elapsedMs(state: EngineState, at = now()): number {
  if (state.masteredAt != null) return state.accumulatedMs
  const running = state.paused ? 0 : Math.max(0, at - state.startedAt)
  return state.accumulatedMs + running
}

export function sessionElapsedMs(state: EngineState, at = now()): number {
  const running = state.paused ? 0 : Math.max(0, at - state.startedAt)
  return state.session.accumulatedMs + running
}

export function wpm(state: EngineState, at = now()): number {
  const minutes = elapsedMs(state, at) / 60000
  if (minutes <= 0 || state.charCorrect === 0) return 0
  return Math.round(state.charCorrect / 5 / minutes)
}

export function sessionWpm(state: EngineState, at = now()): number {
  const minutes = sessionElapsedMs(state, at) / 60000
  if (minutes <= 0 || state.session.charCorrect === 0) return 0
  return Math.round(state.session.charCorrect / 5 / minutes)
}

export function sessionAccuracy(state: EngineState): number {
  const total = state.session.charCorrect + state.session.charWrong
  if (total === 0) return 100
  return Math.round((state.session.charCorrect / total) * 100)
}

export function hotErrorLetters(errors: LetterErrors, limit = 5): { letter: string; count: number }[] {
  return Object.entries(errors)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([letter, count]) => ({ letter, count }))
}

export function settlement(state: EngineState, at = now()): Settlement {
  const unfinished =
    state.allDone || state.stage === 'mastered' ? null : currentWord(state).word
  return {
    wordsMastered: state.session.wordsMastered,
    reviewsDone: state.session.reviewsDone,
    studyMs: sessionElapsedMs(state, at),
    charsTyped: state.session.charCorrect + state.session.charWrong,
    charCorrect: state.session.charCorrect,
    charWrong: state.session.charWrong,
    wpm: sessionWpm(state, at),
    accuracy: sessionAccuracy(state),
    hotErrorLetters: hotErrorLetters(state.session.letterErrors),
    masteredWords: state.session.masteredWords,
    longMastered: 0,
    unfinished,
    nextReviewLabel: '复习计划将在阶段3启用',
  }
}

export function maskWord(word: string): string {
  return word
    .split('')
    .map((ch, i) => {
      if (i === 0 || i === word.length - 1) return ch
      if (i % 2 === 1) return '_'
      return ch
    })
    .join('')
}

export function finalPromptFor(wordIndex: number): FinalPrompt {
  const cycle: FinalPrompt[] = ['chinese', 'audio', 'context']
  return cycle[wordIndex % cycle.length]
}

export function visibleTarget(state: EngineState): string {
  const word = currentWord(state).word
  if (state.stage === 'understand') return word
  if (state.stage === 'copy') return word
  if (state.stage === 'fadePartial') return maskWord(word)
  if (state.flashWordUntil > now()) return word
  return ''
}

function resetTyping(state: EngineState): EngineState {
  return {
    ...state,
    typed: '',
    usedHintThisAttempt: false,
  }
}

function applyHelp(state: EngineState): { next: EngineState; events: EngineEvent[] } {
  const kind = HELP_STEPS[Math.min(state.helpLevel, HELP_STEPS.length - 1)]
  const nextLevel = Math.min(state.helpLevel + 1, HELP_STEPS.length)
  let next: EngineState = {
    ...state,
    helpLevel: nextLevel,
    consecutiveMistakes: 0,
    usedHintThisAttempt: true,
    consecutiveCorrect: 0,
    message: '已使用帮助，需重新无提示完成。',
  }
  if (kind === 'speech') next = { ...next, message: '已重播美式系统发音。帮助后需无提示重来。' }
  if (kind === 'ipa') next = { ...next, showIpa: true }
  if (kind === 'syllable') next = { ...next, showSyllable: true }
  if (kind === 'root') next = { ...next, showRoot: true }
  if (kind === 'flash') next = { ...next, flashWordUntil: now() + 900 }
  if (kind === 'restart') {
    next = resetTyping({
      ...next,
      consecutiveCorrect: 0,
      helpLevel: 0,
      showIpa: state.stage === 'copy' || state.stage === 'fadePartial' || state.stage === 'fadeHidden',
      showSyllable: false,
      showRoot: false,
      showInitial: false,
      message: '本关已重置。不能因失败自动放行。',
    })
  }
  return { next, events: [{ type: 'help', kind }] }
}

function enterStage(state: EngineState, stage: StageId): EngineState {
  return {
    ...state,
    stage,
    typed: '',
    consecutiveCorrect: 0,
    usedHintThisAttempt: false,
    consecutiveMistakes: 0,
    helpLevel: 0,
    stageAttempts: 0,
    showIpa: stage === 'understand' || stage === 'copy' || stage === 'fadePartial' || stage === 'fadeHidden',
    showSyllable: false,
    showRoot: stage === 'understand',
    showInitial: false,
    flashWordUntil: 0,
    message: stage === 'mastered' ? '本词已攻克' : '',
    masteredAt: stage === 'mastered' ? now() : null,
    accumulatedMs: stage === 'mastered' ? elapsedMs(state) : state.accumulatedMs,
    paused: false,
    pauseStartedAt: null,
  }
}

function completeAttempt(state: EngineState): { next: EngineState; events: EngineEvent[] } {
  const stage = state.stage
  if (stage === 'understand' || stage === 'mastered') {
    return { next: state, events: [] }
  }
  const attempted: EngineState = { ...state, attempts: state.attempts + 1, stageAttempts: state.stageAttempts + 1 }
  if (attempted.usedHintThisAttempt) {
    return {
      next: resetTyping({
        ...attempted,
        consecutiveCorrect: 0,
        consecutiveMistakes: 0,
        message: '本次使用了提示，不计入无提示连续正确。请再打一遍。',
      }),
      events: [{ type: 'need-unprompted' }],
    }
  }
  const need = REQUIRED[stage]
  const streak = attempted.consecutiveCorrect + 1
  if (streak < need) {
    return {
      next: resetTyping({
        ...attempted,
        consecutiveCorrect: streak,
        consecutiveMistakes: 0,
        helpLevel: 0,
        message: `连续正确 ${streak}/${need}`,
      }),
      events: [{ type: 'letter-ok', char: '' }],
    }
  }
  const idx = STAGE_ORDER.indexOf(stage)
  const nextStage = STAGE_ORDER[idx + 1]
  let next = enterStage({ ...attempted, consecutiveCorrect: 0, consecutiveMistakes: 0 }, nextStage)
  if (nextStage === 'mastered') {
    const word = currentWord(attempted).word
    next = {
      ...next,
      session: {
        ...attempted.session,
        wordsMastered: attempted.session.wordsMastered + 1,
        masteredWords: [...attempted.session.masteredWords, word],
      },
    }
  }
  const events: EngineEvent[] =
    nextStage === 'mastered'
      ? [{ type: 'stage-cleared', stage }, { type: 'word-mastered' }]
      : [{ type: 'stage-cleared', stage }]
  const audioPrompt =
    nextStage === 'listen' || (nextStage === 'final' && finalPromptFor(state.wordIndex) === 'audio')
  if (audioPrompt) events.push({ type: 'speech-replay' })
  return { next, events }
}

export function startSiege(state: EngineState): { next: EngineState; events: EngineEvent[] } {
  if (state.stage !== 'understand' || state.paused) return { next: state, events: [] }
  return {
    next: enterStage({ ...state, startedAt: now(), accumulatedMs: 0, message: '' }, 'copy'),
    events: [],
  }
}

export function requestHint(
  state: EngineState,
  kind: 'ipa' | 'initial' | 'speech',
): { next: EngineState; events: EngineEvent[] } {
  if (state.paused) return { next: state, events: [] }
  if (state.stage === 'understand' || state.stage === 'mastered') {
    return { next: state, events: kind === 'speech' ? [{ type: 'speech-replay' }] : [] }
  }
  if (kind === 'speech') {
    const countsAsHint = state.stage !== 'listen' && !(state.stage === 'final' && finalPromptFor(state.wordIndex) === 'audio')
    if (!countsAsHint) return { next: state, events: [{ type: 'speech-replay' }] }
    return {
      next: {
        ...state,
        usedHintThisAttempt: true,
        consecutiveCorrect: 0,
        message: '已重播美式系统发音。本次不计入无提示正确。',
      },
      events: [{ type: 'speech-replay' }, { type: 'hint-used' }],
    }
  }
  if (kind === 'ipa') {
    return {
      next: {
        ...state,
        showIpa: true,
        usedHintThisAttempt: true,
        consecutiveCorrect: 0,
        message: '已显示 UK IPA。本次不计入无提示正确。',
      },
      events: [{ type: 'hint-used' }],
    }
  }
  return {
    next: {
      ...state,
      showInitial: true,
      usedHintThisAttempt: true,
      consecutiveCorrect: 0,
      message: '已显示首字母。本次不计入无提示正确。',
    },
    events: [{ type: 'hint-used' }],
  }
}

function isWordChar(ch: string): boolean {
  return /^[a-z]$/.test(ch)
}

function isTargetMark(ch: string): boolean {
  return ch === "-" || ch === "'"
}

function withTargetMarks(state: EngineState): EngineState {
  const target = currentWord(state).word.toLowerCase()
  let typed = state.typed
  while (typed.length < target.length && isTargetMark(target[typed.length] ?? '')) {
    typed += target[typed.length]
  }
  return typed === state.typed ? state : { ...state, typed }
}

export function typeChar(state: EngineState, raw: string): { next: EngineState; events: EngineEvent[] } {
  if (state.paused || state.stage === 'understand' || state.stage === 'mastered' || state.allDone) {
    return { next: state, events: [] }
  }
  let cur = withTargetMarks(state)
  if (cur.stage !== state.stage) return { next: cur, events: [] }
  const ch = raw.toLowerCase()
  if (!isWordChar(ch) && !isTargetMark(ch)) return { next: cur, events: [] }
  const target = currentWord(cur).word.toLowerCase()
  const expected = target[cur.typed.length]
  if (isTargetMark(ch) && expected !== ch) return { next: cur, events: [] }
  const nextTyped = cur.typed + ch
  if (ch === expected) {
    const afterTyped: EngineState = {
      ...cur,
      typed: nextTyped,
      charCorrect: cur.charCorrect + 1,
      consecutiveMistakes: 0,
      session: { ...cur.session, charCorrect: cur.session.charCorrect + 1 },
    }
    const afterMarks = withTargetMarks(afterTyped)
    const filled = afterMarks.typed.length === target.length || afterMarks.stage !== cur.stage
    if (afterMarks.stage !== cur.stage) return { next: afterMarks, events: [{ type: 'letter-ok', char: ch }] }
    if (!filled) return { next: afterMarks, events: [{ type: 'letter-ok', char: ch }] }
    return completeAttempt(afterMarks)
  }
  const afterWrong: EngineState = {
    ...cur,
    charWrong: cur.charWrong + 1,
    errors: cur.errors + 1,
    consecutiveMistakes: cur.consecutiveMistakes + 1,
    consecutiveCorrect: 0,
    letterErrors: bumpError(cur.letterErrors, expected || ch),
    session: {
      ...cur.session,
      charWrong: cur.session.charWrong + 1,
      letterErrors: bumpError(cur.session.letterErrors, expected || ch),
    },
    message: `第 ${cur.typed.length + 1} 个字母不对`,
  }
  if (cur.mode === 'review' && cur.stage === 'final') {
    return {
      next: failReviewToSiege({ ...afterWrong, typed: cur.typed }),
      events: [{ type: 'letter-bad', char: ch }],
    }
  }
  if (afterWrong.consecutiveMistakes >= 2) {
    const helped = applyHelp(afterWrong)
    return {
      next: { ...helped.next, typed: cur.typed },
      events: [{ type: 'letter-bad', char: ch }, ...helped.events],
    }
  }
  return { next: afterWrong, events: [{ type: 'letter-bad', char: ch }] }
}

export function backspace(state: EngineState): EngineState {
  if (state.paused || !state.typed) return state
  return { ...state, typed: state.typed.slice(0, -1) }
}

export function blockPaste(state: EngineState): { next: EngineState; events: EngineEvent[] } {
  return {
    next: { ...state, message: '不能粘贴完成。请逐字输入。' },
    events: [{ type: 'paste-blocked' }],
  }
}

export function pause(state: EngineState, at = now()): { next: EngineState; events: EngineEvent[] } {
  if (state.paused || state.stage === 'mastered' || state.allDone) return { next: state, events: [] }
  return {
    next: {
      ...state,
      paused: true,
      pauseStartedAt: at,
      accumulatedMs: elapsedMs(state, at),
      startedAt: at,
      session: { ...state.session, accumulatedMs: sessionElapsedMs(state, at) },
      message: '已暂停。当前词进度已保存。',
    },
    events: [{ type: 'paused' }],
  }
}

export function resume(state: EngineState, at = now()): { next: EngineState; events: EngineEvent[] } {
  if (!state.paused) return { next: state, events: [] }
  return {
    next: {
      ...state,
      paused: false,
      pauseStartedAt: null,
      startedAt: at,
      message: '已继续当前词。',
    },
    events: [{ type: 'resumed' }],
  }
}

export function nextWord(state: EngineState): { next: EngineState; ok: boolean } {
  if (!canAdvanceWord(state)) return { next: state, ok: false }
  const at = now()
  if (state.mode === 'review') {
    return {
      next: createInitialState({
        wordIndex: state.learnIndex,
        learnIndex: state.learnIndex,
        motion: state.motion,
        soundEnabled: state.soundEnabled,
        speechEnabled: state.speechEnabled,
        session: {
          ...state.session,
          accumulatedMs: sessionElapsedMs(state, at),
          reviewsDone: state.session.reviewsDone + 1,
        },
        startedAt: at,
        mode: 'learn',
        reviewWordId: null,
      }),
      ok: true,
    }
  }
  const nextIndex = state.wordIndex + 1
  if (nextIndex >= TEST_WORDS.length) {
    return {
      next: {
        ...state,
        allDone: true,
        paused: false,
        message: '本词库已全部攻克。',
      },
      ok: true,
    }
  }
  return {
    next: createInitialState({
      wordIndex: nextIndex,
      learnIndex: nextIndex,
      motion: state.motion,
      soundEnabled: state.soundEnabled,
      speechEnabled: state.speechEnabled,
      session: {
        ...state.session,
        accumulatedMs: sessionElapsedMs(state, at),
        reviewsDone: state.session.reviewsDone,
      },
      startedAt: at,
      accumulatedMs: 0,
      mode: 'learn',
      reviewWordId: null,
    }),
    ok: true,
  }
}

export function startReview(state: EngineState, wordIndex: number): EngineState {
  const word = TEST_WORDS[wordIndex]
  if (!word) return state
  const at = now()
  return createInitialState({
    wordIndex,
    learnIndex: state.learnIndex,
    mode: 'review',
    reviewWordId: word.id,
    stage: 'final',
    motion: state.motion,
    soundEnabled: state.soundEnabled,
    speechEnabled: state.speechEnabled,
    session: state.session,
    startedAt: at,
    message: '复习：无提示通过最终攻坚。',
  })
}

export function failReviewToSiege(state: EngineState): EngineState {
  if (state.mode !== 'review') return state
  return {
    ...state,
    mode: 'review',
    stage: 'copy',
    typed: '',
    consecutiveCorrect: 0,
    usedHintThisAttempt: false,
    consecutiveMistakes: 0,
    helpLevel: 0,
    stageAttempts: 0,
    showIpa: true,
    showSyllable: false,
    showRoot: false,
    showInitial: false,
    message: '复习失败，重新进入完整攻坚。',
  }
}

export function endSession(state: EngineState): EngineState {
  const paused = state.paused ? state : pause(state).next
  return { ...paused, message: '已保存。下次将继续当前词。' }
}

export function setMotion(state: EngineState, motion: EngineState['motion']): EngineState {
  return { ...state, motion }
}

export function setSound(state: EngineState, soundEnabled: boolean): EngineState {
  return { ...state, soundEnabled }
}

export function setSpeech(state: EngineState, speechEnabled: boolean): EngineState {
  return { ...state, speechEnabled }
}

export function stageTitle(stage: StageId): string {
  switch (stage) {
    case 'understand':
      return '第一关 理解'
    case 'copy':
      return '第二关 看词跟打'
    case 'fadePartial':
      return '第三关 部分隐藏'
    case 'fadeHidden':
      return '第三关 完全隐藏'
    case 'chinese':
      return '第四关 中文拼写'
    case 'listen':
      return '第五关 听音拼写'
    case 'context':
      return '第六关 语境拼写'
    case 'final':
      return '第七关 最终攻坚'
    case 'mastered':
      return '本词已攻克'
  }
}

export function requiredFor(stage: StageId): number {
  if (stage === 'understand' || stage === 'mastered') return 0
  return REQUIRED[stage]
}

export { STAGE_ORDER, TEST_WORDS }

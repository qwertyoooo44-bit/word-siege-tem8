export type StageId =
  | 'understand'
  | 'copy'
  | 'fadePartial'
  | 'fadeHidden'
  | 'chinese'
  | 'listen'
  | 'context'
  | 'final'
  | 'mastered'

export type MotionPref = 'off' | 'calm' | 'vivid'
export type FinalPrompt = 'chinese' | 'audio' | 'context'
export type HelpKind = 'none' | 'speech' | 'ipa' | 'syllable' | 'root' | 'flash' | 'restart'

export type EngineEvent =
  | { type: 'letter-ok'; char: string }
  | { type: 'letter-bad'; char: string }
  | { type: 'paste-blocked' }
  | { type: 'stage-cleared'; stage: StageId }
  | { type: 'word-mastered' }
  | { type: 'hint-used' }
  | { type: 'help'; kind: HelpKind }
  | { type: 'need-unprompted' }
  | { type: 'speech-replay' }
  | { type: 'paused' }
  | { type: 'resumed' }

export type LetterErrors = Record<string, number>

export type SessionStats = {
  wordsMastered: number
  reviewsDone: number
  charCorrect: number
  charWrong: number
  startedAt: number
  accumulatedMs: number
  letterErrors: LetterErrors
  masteredWords: string[]
}

export type Settlement = {
  wordsMastered: number
  reviewsDone: number
  studyMs: number
  charsTyped: number
  charCorrect: number
  charWrong: number
  wpm: number
  accuracy: number
  hotErrorLetters: { letter: string; count: number }[]
  masteredWords: string[]
  longMastered: number
  unfinished: string | null
  nextReviewLabel: string
}

export type EngineState = {
  wordIndex: number
  stage: StageId
  typed: string
  consecutiveCorrect: number
  usedHintThisAttempt: boolean
  consecutiveMistakes: number
  helpLevel: number
  showIpa: boolean
  showSyllable: boolean
  showRoot: boolean
  showInitial: boolean
  flashWordUntil: number
  attempts: number
  stageAttempts: number
  charCorrect: number
  charWrong: number
  errors: number
  letterErrors: LetterErrors
  startedAt: number
  accumulatedMs: number
  paused: boolean
  pauseStartedAt: number | null
  masteredAt: number | null
  motion: MotionPref
  soundEnabled: boolean
  speechEnabled: boolean
  allDone: boolean
  message: string
  session: SessionStats
  mode: 'learn' | 'review'
  learnIndex: number
  reviewWordId: string | null
}

export type PersistV1 = {
  v: 1
  wordIndex: number
  stage: StageId
  consecutiveCorrect: number
  usedHintThisAttempt: boolean
  helpLevel: number
  attempts: number
  charCorrect: number
  charWrong: number
  errors: number
  startedAt: number
  motion: MotionPref
  soundEnabled: boolean
  speechEnabled: boolean
  allDone: boolean
}

export type PersistV2 = {
  v: 2
  wordIndex: number
  wordId?: string
  stage: StageId
  typed: string
  consecutiveCorrect: number
  usedHintThisAttempt: boolean
  helpLevel: number
  consecutiveMistakes: number
  attempts: number
  stageAttempts: number
  charCorrect: number
  charWrong: number
  errors: number
  letterErrors: LetterErrors
  startedAt: number
  accumulatedMs: number
  paused: boolean
  motion: MotionPref
  soundEnabled: boolean
  speechEnabled: boolean
  allDone: boolean
  session: SessionStats
  mode: 'learn' | 'review'
  learnIndex: number
  reviewWordId: string | null
}

export type PersistState = PersistV1 | PersistV2

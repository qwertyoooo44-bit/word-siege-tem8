import { backspace, typeChar } from '../engine/machine'
import type { EngineEvent, EngineState, StageId } from '../engine/types'

export type InputSource = 'app-keyboard' | 'physical' | 'system'

export type InputAction =
  | { type: 'insertCharacter'; char: string; source: InputSource }
  | { type: 'deleteCharacter'; source: InputSource }
  | { type: 'submitAnswer'; source: InputSource }
  | { type: 'clearInput'; source: InputSource }

export type InputSession = {
  state: EngineState
  draft: string
}

export type InputResult = {
  next: EngineState
  draft: string
  events: EngineEvent[]
  accepted: boolean
  live: boolean
}

const LETTER = /^[a-z]$/
const MARK = /^[-']$/

export function isRecallStage(stage: StageId): boolean {
  return stage === 'fadePartial' || stage === 'fadeHidden' || stage === 'chinese' || stage === 'listen' || stage === 'context' || stage === 'final'
}

export function isTypingStage(state: EngineState): boolean {
  return !state.paused && !state.allDone && state.stage !== 'understand' && state.stage !== 'mastered'
}

export function sanitizeInsertChar(raw: string): string | null {
  if (!raw) return null
  const ch = raw.toLowerCase()
  if (ch.length !== 1) return null
  if (LETTER.test(ch) || MARK.test(ch)) return ch
  return null
}

export function displayedInput(state: EngineState, draft: string): string {
  if (isRecallStage(state.stage)) return draft
  return state.typed
}

function flushDraft(state: EngineState, draft: string): { next: EngineState; events: EngineEvent[] } {
  let cur = state
  const events: EngineEvent[] = []
  for (const ch of draft) {
    const result = typeChar(cur, ch)
    events.push(...result.events)
    cur = result.next
    if (result.events.some((ev) => ev.type === 'letter-bad')) break
    if (cur.stage !== state.stage) break
  }
  return { next: cur, events }
}

export function applyInputAction(session: InputSession, action: InputAction): InputResult {
  const { state } = session
  let { draft } = session

  if (action.type === 'clearInput') {
    if (isRecallStage(state.stage)) {
      if (!draft) return { next: state, draft, events: [], accepted: false, live: false }
      return { next: state, draft: '', events: [], accepted: true, live: false }
    }
    if (!state.typed) return { next: state, draft: '', events: [], accepted: false, live: true }
    return { next: { ...state, typed: '' }, draft: '', events: [], accepted: true, live: true }
  }

  if (!isTypingStage(state)) {
    return { next: state, draft, events: [], accepted: false, live: !isRecallStage(state.stage) }
  }

  const live = !isRecallStage(state.stage)

  if (action.type === 'insertCharacter') {
    const ch = sanitizeInsertChar(action.char)
    if (!ch) return { next: state, draft, events: [], accepted: false, live }
    if (!live) {
      if (draft.length >= 48) return { next: state, draft, events: [], accepted: false, live }
      return { next: state, draft: draft + ch, events: [], accepted: true, live }
    }
    const result = typeChar(state, ch)
    return {
      next: result.next,
      draft: '',
      events: result.events,
      accepted: result.next !== state || result.events.length > 0,
      live,
    }
  }

  if (action.type === 'deleteCharacter') {
    if (!live) {
      if (!draft) return { next: state, draft, events: [], accepted: false, live }
      return { next: state, draft: draft.slice(0, -1), events: [], accepted: true, live }
    }
    const next = backspace(state)
    return { next, draft: '', events: [], accepted: next.typed !== state.typed, live }
  }

  if (!live) {
    if (!draft) {
      return {
        next: { ...state, message: '请先拼写当前词，再确认。' },
        draft,
        events: [],
        accepted: false,
        live,
      }
    }
    const flushed = flushDraft(state, draft)
    return { next: flushed.next, draft: '', events: flushed.events, accepted: true, live }
  }

  return { next: state, draft: '', events: [], accepted: false, live }
}

export function physicalKeyToAction(
  key: string,
  modifiers: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean },
): InputAction | 'passthrough' | null {
  if (modifiers.ctrl || modifiers.meta || modifiers.alt) return 'passthrough'
  if (
    key === 'Tab' ||
    key === 'Escape' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown'
  ) {
    return 'passthrough'
  }
  if (key === 'Enter') return { type: 'submitAnswer', source: 'physical' }
  if (key === 'Backspace' || key === 'Delete') return { type: 'deleteCharacter', source: 'physical' }
  if (key.length === 1) {
    const ch = sanitizeInsertChar(key)
    if (ch) return { type: 'insertCharacter', char: ch, source: 'physical' }
    return null
  }
  return null
}

export function systemValueToActions(
  previousTyped: string,
  nextValue: string,
  source: InputSource = 'system',
): InputAction[] {
  const cleaned = nextValue.toLowerCase().replace(/[^a-z'-]/g, '')
  if (cleaned === previousTyped) return []
  if (!cleaned) return previousTyped ? [{ type: 'clearInput', source }] : []
  if (cleaned.length < previousTyped.length && previousTyped.startsWith(cleaned)) {
    const actions: InputAction[] = []
    for (let i = 0; i < previousTyped.length - cleaned.length; i += 1) {
      actions.push({ type: 'deleteCharacter', source })
    }
    return actions
  }
  if (cleaned.startsWith(previousTyped)) {
    return cleaned
      .slice(previousTyped.length)
      .split('')
      .map((char) => ({ type: 'insertCharacter', char, source }) as InputAction)
  }
  const actions: InputAction[] = []
  if (previousTyped) actions.push({ type: 'clearInput', source })
  for (const char of cleaned) actions.push({ type: 'insertCharacter', char, source })
  return actions
}

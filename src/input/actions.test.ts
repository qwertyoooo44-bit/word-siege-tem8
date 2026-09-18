import { describe, expect, it } from 'vitest'
import { createInitialState, currentWord, typeChar } from '../engine/machine'
import {
  applyInputAction,
  displayedInput,
  isRecallStage,
  physicalKeyToAction,
  sanitizeInsertChar,
  systemValueToActions,
} from './actions'
import { KEYBOARD_ROWS, LETTER_KEY_COUNT } from './layout'

describe('unified input actions', () => {
  it('uses one QWERTY layout with delete and confirm', () => {
    expect(LETTER_KEY_COUNT).toBe(26)
    expect(KEYBOARD_ROWS[0].map((k) => ('char' in k ? k.char : k.id)).join('')).toBe('qwertyuiop')
    expect(KEYBOARD_ROWS[3].map((k) => k.id)).toEqual(['delete', 'confirm'])
  })

  it('rejects emoji html and non-english characters', () => {
    expect(sanitizeInsertChar('😀')).toBeNull()
    expect(sanitizeInsertChar('<')).toBeNull()
    expect(sanitizeInsertChar('中')).toBeNull()
    expect(sanitizeInsertChar('A')).toBe('a')
    expect(sanitizeInsertChar('-')).toBe('-')
  })

  it('shares scoring with typeChar on live copy stage', () => {
    const start = createInitialState({ stage: 'copy' })
    const word = currentWord(start).word
    let viaActions = start
    let viaEngine = start
    let draft = ''
    for (const ch of word.slice(0, 4)) {
      const routed = applyInputAction({ state: viaActions, draft }, { type: 'insertCharacter', char: ch, source: 'app-keyboard' })
      viaActions = routed.next
      draft = routed.draft
      viaEngine = typeChar(viaEngine, ch).next
    }
    const d1 = applyInputAction({ state: viaActions, draft }, { type: 'deleteCharacter', source: 'physical' })
    viaActions = d1.next
    const d2 = applyInputAction({ state: viaActions, draft: d1.draft }, { type: 'deleteCharacter', source: 'system' })
    viaActions = d2.next
    viaEngine = { ...viaEngine, typed: viaEngine.typed.slice(0, -2) }
    expect(viaActions.typed).toBe(viaEngine.typed)
    expect(viaActions.charCorrect).toBe(viaEngine.charCorrect)
  })

  it('keeps abacus edits on a single scoring path', () => {
    let cur = createInitialState({ stage: 'chinese' })
    let draft = ''
    for (const ch of 'abacus') {
      const r = applyInputAction({ state: cur, draft }, { type: 'insertCharacter', char: ch, source: 'app-keyboard' })
      cur = r.next
      draft = r.draft
    }
    expect(draft).toBe('abacus')
    expect(cur.typed).toBe('')
    const d1 = applyInputAction({ state: cur, draft }, { type: 'deleteCharacter', source: 'app-keyboard' })
    const d2 = applyInputAction({ state: d1.next, draft: d1.draft }, { type: 'deleteCharacter', source: 'app-keyboard' })
    expect(d2.draft).toBe('abac')
    const u = applyInputAction({ state: d2.next, draft: d2.draft }, { type: 'insertCharacter', char: 'u', source: 'physical' })
    const s = applyInputAction({ state: u.next, draft: u.draft }, { type: 'insertCharacter', char: 's', source: 'system' })
    expect(s.draft).toBe('abacus')
    const submitted = applyInputAction({ state: s.next, draft: s.draft }, { type: 'submitAnswer', source: 'app-keyboard' })
    expect(submitted.draft).toBe('')
    expect(submitted.next.charCorrect).toBeGreaterThan(0)
  })

  it('does not score recall input until confirm', () => {
    const start = createInitialState({ stage: 'chinese' })
    const typed = applyInputAction({ state: start, draft: '' }, { type: 'insertCharacter', char: 'z', source: 'app-keyboard' })
    expect(typed.next.charWrong).toBe(0)
    expect(typed.draft).toBe('z')
    const submitted = applyInputAction({ state: typed.next, draft: typed.draft }, { type: 'submitAnswer', source: 'app-keyboard' })
    expect(submitted.next.charWrong).toBe(1)
    expect(submitted.events.some((e) => e.type === 'letter-bad')).toBe(true)
  })

  it('double confirm does not resubmit an empty draft', () => {
    const start = createInitialState({ stage: 'listen' })
    const first = applyInputAction({ state: start, draft: '' }, { type: 'submitAnswer', source: 'app-keyboard' })
    const second = applyInputAction({ state: first.next, draft: first.draft }, { type: 'submitAnswer', source: 'app-keyboard' })
    expect(first.next.charCorrect).toBe(0)
    expect(second.next.charCorrect).toBe(0)
  })

  it('maps physical keys without swallowing accessibility shortcuts', () => {
    expect(physicalKeyToAction('Tab', { ctrl: false, meta: false, alt: false, shift: false })).toBe('passthrough')
    expect(physicalKeyToAction('Escape', { ctrl: false, meta: false, alt: false, shift: false })).toBe('passthrough')
    expect(physicalKeyToAction('a', { ctrl: true, meta: false, alt: false, shift: false })).toBe('passthrough')
    expect(physicalKeyToAction('Enter', { ctrl: false, meta: false, alt: false, shift: false })).toEqual({
      type: 'submitAnswer',
      source: 'physical',
    })
    expect(physicalKeyToAction('Backspace', { ctrl: false, meta: false, alt: false, shift: false })).toEqual({
      type: 'deleteCharacter',
      source: 'physical',
    })
  })

  it('converts system input values into the same actions', () => {
    expect(systemValueToActions('ab', 'abac')).toEqual([
      { type: 'insertCharacter', char: 'a', source: 'system' },
      { type: 'insertCharacter', char: 'c', source: 'system' },
    ])
    expect(systemValueToActions('abac', 'aba')).toEqual([{ type: 'deleteCharacter', source: 'system' }])
    expect(systemValueToActions('ab', '😀')).toEqual([{ type: 'clearInput', source: 'system' }])
  })

  it('keeps twenty rapid inserts without dropping letters', () => {
    let cur = createInitialState({ stage: 'copy' })
    let draft = ''
    const chars = 'abcdefghijklmnopqrst'
    for (const ch of chars) {
      const r = applyInputAction({ state: cur, draft }, { type: 'insertCharacter', char: ch, source: 'app-keyboard' })
      cur = r.next
      draft = r.draft
    }
    expect(cur.typed.startsWith('abacus') || cur.charCorrect + cur.charWrong >= 6).toBe(true)
    cur = createInitialState({ stage: 'context' })
    draft = ''
    for (const ch of chars) {
      const r = applyInputAction({ state: cur, draft }, { type: 'insertCharacter', char: ch, source: 'app-keyboard' })
      cur = r.next
      draft = r.draft
    }
    expect(draft).toBe(chars)
    expect(cur.typed).toBe('')
  })

  it('marks recall stages for delayed feedback', () => {
    expect(isRecallStage('copy')).toBe(false)
    expect(isRecallStage('fadePartial')).toBe(true)
    expect(isRecallStage('chinese')).toBe(true)
    expect(displayedInput(createInitialState({ stage: 'copy', typed: 'ab' }), 'zz')).toBe('ab')
    expect(displayedInput(createInitialState({ stage: 'listen' }), 'zz')).toBe('zz')
  })
})

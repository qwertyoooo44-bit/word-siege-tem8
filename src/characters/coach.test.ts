import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/machine'
import { coachForEvents, greetingForWord } from './coach'

describe('character coaching', () => {
  it('does not cheer every letter and keeps a cooldown', () => {
    const state = createInitialState({ stage: 'copy' })
    expect(coachForEvents(state, [{ type: 'letter-ok', char: 'a' }], 'auto')).toBeNull()
    const first = greetingForWord('abacus', 'auto', 1_000)
    const second = greetingForWord('abacus', 'auto', 2_000)
    expect(first?.text).toContain('一次只处理')
    expect(second).toBeNull()
  })

  it('can be hidden completely', () => {
    const state = createInitialState({ stage: 'final' })
    expect(coachForEvents(state, [{ type: 'word-mastered' }], 'hidden')).toBeNull()
  })
})

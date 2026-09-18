import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('english keyboard component', () => {
  it('does not open a text field or fetch on key press', () => {
    const src = readFileSync('src/input/EnglishKeyboard.tsx', 'utf8')
    expect(src).not.toContain('<input')
    expect(src).not.toContain('fetch(')
    expect(src).toContain('insertCharacter')
    expect(src).toContain('deleteCharacter')
    expect(src).toContain('submitAnswer')
    expect(src).toContain('onClick')
  })

  it('keeps min key height and large-key mode in css', () => {
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toContain('.kb-key')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('.english-kb.large')
    expect(css).toContain('env(safe-area-inset-bottom)')
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('mobile viewport', () => {
  it('keeps dynamic viewport and safe-area usage', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('viewport-fit=cover')
    expect(html).not.toContain('user-scalable=no')
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toContain('100svh')
    expect(css).toContain('100dvh')
    expect(css).toContain('env(safe-area-inset-bottom)')
    expect(css).toContain('min-height: 44px')
  })
})

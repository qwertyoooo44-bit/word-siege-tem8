import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('pwa assets', () => {
  it('has a standalone manifest and offline service worker', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
      display: string
      start_url: string
      icons: { src: string }[]
    }
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('./')
    expect(manifest.icons.length).toBeGreaterThan(1)
    const sw = readFileSync('public/sw.js', 'utf8')
    expect(sw).toContain('caches.open')
    expect(sw).toContain('SKIP_WAITING')
    expect(sw).toContain('word-siege-tem8-v2-packs')
    expect(readFileSync('public/packs/tem8.json', 'utf8').length).toBeGreaterThan(1_000_000)
  })
})

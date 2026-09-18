import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { AUDIO_PACK_MANIFEST } from './packs.meta'
import { SOUND_PACK_LICENSE } from '../audio'

describe('procedural sound packs', () => {
  it('records original licenses and does not vendor third-party audio', () => {
    expect(AUDIO_PACK_MANIFEST).toHaveLength(4)
    expect(SOUND_PACK_LICENSE.copiedFrom).toEqual([])
    const audio = readFileSync('src/audio.ts', 'utf8')
    expect(audio).toContain('createOscillator')
    expect(audio).not.toMatch(/\.mp3|\.wav/)
  })
})

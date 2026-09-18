import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PACK_META, SAMPLE_WORDS, officialPackLoaded } from './pack'

describe('on-demand TEM8 pack', () => {
  it('keeps the full lexicon out of the default source module', () => {
    const pack = readFileSync('src/data/pack.ts', 'utf8')
    expect(pack).not.toContain("from './tem8.json'")
    expect(pack).toContain("from './sample40.json'")
    expect(SAMPLE_WORDS).toHaveLength(40)
    expect(officialPackLoaded()).toBe(true)
    expect(PACK_META.learnableCount).toBe(3826)
  })
})

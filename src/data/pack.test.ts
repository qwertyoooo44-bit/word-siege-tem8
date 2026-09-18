import { describe, expect, it } from 'vitest'
import { PACK_META, WORDS, displayIpa } from './pack'

describe('official TEM8 pack', () => {
  it('keeps lemma count separate from learnable siege queue', () => {
    expect(PACK_META.lemmaCount).toBe(3984)
    expect(WORDS).toHaveLength(PACK_META.learnableCount)
    expect(PACK_META.learnableCount).toBe(3826)
    expect(PACK_META.incompleteCount).toBe(158)
    expect(WORDS.every((w) => w.learnable && w.ipa && w.pos && w.gloss && w.context)).toBe(true)
    expect(WORDS[0]?.word).toBe('abacus')
    expect(WORDS[0]?.gloss).toContain('算盘')
    expect(PACK_META.dataLicense).toContain('CC BY-SA 4.0')
    expect(WORDS[0]?.pronunciationRegion).toMatch(/^UK/)
    expect(displayIpa(WORDS[0])).toMatch(/^UK IPA \//)
    expect(displayIpa(WORDS[0])).not.toMatch(/US IPA/)
  })
})

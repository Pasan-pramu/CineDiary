import { describe, expect, it } from 'vitest'
import type { LanguageBreakdown } from '../../../shared/types'
import { languageSentence } from './insightSentences'

function breakdown(languageCount: number, top: [string, number] | null): LanguageBreakdown {
  return {
    total: 10,
    languageCount,
    top: top ? { key: 'x', label: top[0], titles: 0, share: top[1] } : null,
    bars: []
  }
}

describe('languageSentence', () => {
  it('says "mostly" from half the titles, "most often" below', () => {
    expect(languageSentence(breakdown(6, ['English', 0.75]), 'all')).toBe(
      "You've watched movies and series in 6 languages; mostly English."
    )
    expect(languageSentence(breakdown(3, ['Korean', 0.5]), 'movie')).toBe(
      "You've watched movies in 3 languages; mostly Korean."
    )
    expect(languageSentence(breakdown(4, ['Korean', 0.4]), 'series')).toBe(
      "You've watched series in 4 languages; most often Korean."
    )
  })

  it('has its own wording for one language and for none', () => {
    expect(languageSentence(breakdown(1, ['Malayalam', 0.8]), 'all')).toBe(
      "Everything you've watched is in Malayalam."
    )
    expect(languageSentence(breakdown(1, ['Malayalam', 1]), 'movie')).toBe(
      "Every movie you've watched is in Malayalam."
    )
    expect(languageSentence(breakdown(0, null), 'all')).toBe(
      'Add a language to your titles to see which languages you watch in.'
    )
  })
})

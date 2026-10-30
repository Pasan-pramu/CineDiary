import { describe, expect, it } from 'vitest'
import {
  NO_SPOKEN_LANGUAGE,
  NOT_RECORDED_LANGUAGE,
  OTHER_LANGUAGES,
  languageKey,
  languageLabel
} from './languages'

describe('languageKey', () => {
  it('groups codes and names, in any case', () => {
    for (const value of ['en', 'EN', 'en-US', 'en_GB', 'eng', 'English', 'english', ' ENGLISH ']) {
      expect(languageKey(value)).toBe('en')
    }
    expect(languageKey('ko')).toBe('ko')
    expect(languageKey('Korean')).toBe('ko')
    expect(languageKey('ml')).toBe('ml')
    expect(languageKey('malayalam')).toBe('ml')
    expect(languageKey('Tamil')).toBe('ta')
  })

  it('maps old and TMDB-only codes onto one language', () => {
    expect(languageKey('iw')).toBe('he')
    expect(languageKey('Hebrew')).toBe('he')
    // TMDB's "cn" is Cantonese; "sh" is saved as "Serbian (Latin)".
    expect(languageKey('cn')).toBe('yue')
    expect(languageKey('Cantonese')).toBe('yue')
    expect(languageKey('Serbian (Latin)')).toBe('sr')
    expect(languageKey('Mandarin')).toBe(languageKey('zh'))
  })

  it('keeps TMDB "xx" as no spoken language', () => {
    expect(languageKey('xx')).toBe(NO_SPOKEN_LANGUAGE)
    expect(languageKey('XX')).toBe(NO_SPOKEN_LANGUAGE)
  })

  it('groups unknown text ignoring case and spaces', () => {
    expect(languageKey('Klingon')).toBe('text:klingon')
    expect(languageKey('  klingon ')).toBe('text:klingon')
    expect(languageKey('High  Valyrian')).toBe(languageKey('high valyrian'))
    // Three letters, but not a language code.
    expect(languageKey('the')).toBe('text:the')
  })

  it('has no key for an empty language', () => {
    expect(languageKey(null)).toBeNull()
    expect(languageKey(undefined)).toBeNull()
    expect(languageKey('   ')).toBeNull()
  })
})

describe('languageLabel', () => {
  it('names codes in English', () => {
    expect(languageLabel('en')).toBe('English')
    expect(languageLabel('ko')).toBe('Korean')
    expect(languageLabel('ml')).toBe('Malayalam')
    expect(languageLabel('yue')).toBe('Cantonese')
  })

  it('names the special keys', () => {
    expect(languageLabel(NOT_RECORDED_LANGUAGE)).toBe('Not recorded')
    expect(languageLabel(NO_SPOKEN_LANGUAGE)).toBe('No spoken language')
    expect(languageLabel(OTHER_LANGUAGES)).toBe('Other')
  })

  it('shows free text as it was typed, with a capital letter', () => {
    expect(languageLabel('text:klingon', 'Klingon')).toBe('Klingon')
    expect(languageLabel('text:klingon', 'klingon')).toBe('Klingon')
    expect(languageLabel('text:klingon')).toBe('Klingon')
  })
})

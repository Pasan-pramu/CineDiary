// Language matching: a title's language is free text. TMDB saves the English name ("Korean",
// see displayName() in services/tmdb.ts), or the bare code when Intl has no name for it ("cn"),
// and anything typed by hand is kept as typed ("english", "en", "Tamil"). languageKey() turns
// all of these into one key, so they count and filter as the same language:
// - a code (2–3 letters, with or without a region: "en", "EN-us", "eng") → its canonical code
// - an English language name, any case ("english") → its code
// - anything else ("Klingon") → `text:<lowercase>`, grouped ignoring case and spaces
// Names come from the built-in Intl.DisplayNames (Electron's ICU), so there is no table of
// names here, only the list of ISO 639-1 codes to look names up from.

/** Titles without a language (also the Collection's `?language=none`). */
export const NOT_RECORDED_LANGUAGE = 'none'
/** TMDB's "No Language" (silent films, music). A bar of its own, but not a language. */
export const NO_SPOKEN_LANGUAGE = 'xx'
/** The bar that groups everything after the top languages. */
export const OTHER_LANGUAGES = 'other'

// ISO 639-1, plus Cantonese (TMDB has its own "cn" for it).
const ISO_639_1 = (
  'aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy ' +
  'da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht ' +
  'hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky ' +
  'la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny ' +
  'oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss ' +
  'st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo ' +
  'za zh zu sh yue'
).split(' ')

/** TMDB codes that aren't real language codes. */
const CODE_ALIASES: Record<string, string> = { cn: 'yue', xx: NO_SPOKEN_LANGUAGE }

/** Common names Intl doesn't use. */
const NAME_ALIASES: Record<string, string> = { mandarin: 'zh', farsi: 'fa', tagalog: 'fil' }

const CODE_SHAPE = /^[a-z]{2,3}([-_][a-z0-9]{1,8})*$/i

const displayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })

/** "EN-us" → "en", "eng" → "en", "iw" → "he"; null when it isn't a valid language tag. */
function canonicalCode(text: string): string | null {
  try {
    return Intl.getCanonicalLocales(text.replace(/_/g, '-'))[0].split('-')[0].toLowerCase()
  } catch {
    return null
  }
}

let namesToCodes: Map<string, string> | null = null

/** "korean" → "ko", "serbian (latin)" → "sr" (TMDB saves "sh" under that name). */
function codeForName(name: string): string | undefined {
  if (!namesToCodes) {
    namesToCodes = new Map(Object.entries(NAME_ALIASES))
    for (const code of ISO_639_1) {
      const canonical = canonicalCode(code) ?? code
      const label = displayNames.of(code)
      // The first code wins when two share a name (Akan: "ak" before "tw").
      if (label && !namesToCodes.has(label.toLowerCase())) {
        namesToCodes.set(label.toLowerCase(), canonical)
      }
    }
  }
  return namesToCodes.get(name)
}

/** The grouping key for a stored language, or null when there is none. */
export function languageKey(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, ' ')
  if (!text) return null
  const lower = text.toLowerCase()
  if (CODE_ALIASES[lower]) return CODE_ALIASES[lower]
  if (CODE_SHAPE.test(text)) {
    const code = canonicalCode(text)
    // A code Intl can't name still counts when it's a real one ("ab" saved by TMDB).
    if (code && (displayNames.of(code) || ISO_639_1.includes(code))) return code
  }
  return codeForName(lower) ?? `text:${lower}`
}

/**
 * What a key is called in the UI. A `text:` key shows `spelling` (the stored value) when given,
 * otherwise the key's own text with a capital letter.
 */
export function languageLabel(key: string, spelling?: string): string {
  if (key === NOT_RECORDED_LANGUAGE) return 'Not recorded'
  if (key === NO_SPOKEN_LANGUAGE) return 'No spoken language'
  if (key === OTHER_LANGUAGES) return 'Other'
  if (key.startsWith('text:')) {
    const text = spelling?.trim().replace(/\s+/g, ' ') || key.slice(5)
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return displayNames.of(key) ?? key
}

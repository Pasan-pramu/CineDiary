import type { MoodKey } from './constants'

/*
 * Discover / For My Mood — the prompts and what they match. Tune this file freely.
 *
 * How a prompt finds titles (see discover() in src/main/services/recommendations.ts):
 * - A past watch is "a similar situation" when its mood BEFORE watching is in `moods`
 *   OR it was tagged with one of `reasons`.
 * - `genres` fit the feeling: they're used for "Haven't watched in a while", and as a labeled
 *   fallback for "From your watchlist" (always ranked below genres your own history proved).
 * - `startMood` / `startReason` pre-fill the Start-watching dialog (both stay editable).
 * - `when` finishes the sentence "Comedy lifted your mood by +2.8 when …" in the "why" lines.
 *
 * Valid values:
 * - moods / startMood: a mood `key` (the moods table; built-in keys are in DEFAULT_MOODS,
 *   src/shared/constants.ts): very_happy, happy, neutral, sad, stressed, demotivated, bored,
 *   lonely, overwhelmed, calm. Renaming a mood in Settings keeps its key, so prompts keep working.
 *   Custom moods (Settings → Moods & reasons) aren't part of any prompt until you add their key
 *   here; it is shown in the JSON export ("moods"), e.g. nostalgic_1a2b3c4d.
 * - reasons / startReason: a reason key = its label in lower case with "_" between words, e.g.
 *   "Needed motivation" → needed_motivation. Defaults: happy, sad, lonely, stressed, demotivated,
 *   needed_motivation, needed_relaxation, wanted_to_laugh, wanted_adrenaline, needed_an_escape,
 *   wanted_something_meaningful, wanted_inspiration, wanted_adventure, curious,
 *   recommended_by_someone, rewatch, other. Custom reasons get a key with a random ending
 *   (e.g. rainy_sunday_1a2b3c4d), also listed in the JSON export.
 * - genres: genre names as they appear in your collection. Matching ignores case and
 *   punctuation, and "Sci-Fi" = "Science Fiction". Unknown names simply match nothing.
 */

export interface DiscoverPrompt {
  /** Used in the URL (/discover?prompt=…); keep it short and unique. */
  key: string
  label: string
  emoji: string
  /** One line under the label on the card. */
  description: string
  /** Finishes "… lifted your mood when <when>", e.g. "you felt down". */
  when: string
  moods: MoodKey[]
  reasons: string[]
  genres: string[]
  startMood: MoodKey | null
  startReason: string | null
}

export const DISCOVER_PROMPTS = [
  {
    key: 'down',
    label: 'I’m feeling down',
    emoji: '🫂',
    description: 'Something warm that has lifted you before.',
    when: 'you felt down',
    moods: ['sad', 'lonely', 'demotivated'],
    reasons: ['sad', 'lonely', 'needed_an_escape'],
    genres: ['Comedy', 'Family', 'Animation'],
    startMood: 'sad',
    startReason: 'sad'
  },
  {
    key: 'motivation',
    label: 'I need motivation',
    emoji: '🔥',
    description: 'Stories that got you going again.',
    when: 'you needed motivation',
    moods: ['demotivated'],
    reasons: ['needed_motivation', 'wanted_inspiration', 'demotivated'],
    genres: ['Documentary', 'Drama', 'Sport'],
    startMood: 'demotivated',
    startReason: 'needed_motivation'
  },
  {
    key: 'laugh',
    label: 'I want to laugh',
    emoji: '😂',
    description: 'Comfort comedy and easy joy.',
    when: 'you wanted to laugh',
    moods: ['bored'],
    reasons: ['wanted_to_laugh'],
    genres: ['Comedy', 'Animation', 'Family'],
    startMood: null,
    startReason: 'wanted_to_laugh'
  },
  {
    key: 'adrenaline',
    label: 'I want adrenaline and action',
    emoji: '⚡',
    description: 'Big, fast and exciting.',
    when: 'you wanted adrenaline',
    moods: ['bored'],
    reasons: ['wanted_adrenaline', 'wanted_adventure'],
    genres: ['Action', 'Thriller', 'Adventure', 'Sci-Fi'],
    startMood: 'bored',
    startReason: 'wanted_adrenaline'
  },
  {
    key: 'peaceful',
    label: 'I want something peaceful',
    emoji: '🌿',
    description: 'Calm stories for a busy mind.',
    when: 'you needed some peace',
    moods: ['stressed', 'overwhelmed'],
    reasons: ['needed_relaxation', 'stressed'],
    genres: ['Animation', 'Documentary', 'Family', 'Romance'],
    startMood: 'stressed',
    startReason: 'needed_relaxation'
  },
  {
    key: 'meaningful',
    label: 'I want a meaningful story',
    emoji: '✨',
    description: 'Something that stays with you.',
    when: 'you wanted something meaningful',
    moods: [],
    reasons: ['wanted_something_meaningful', 'wanted_inspiration'],
    genres: ['Drama', 'Documentary', 'History'],
    startMood: null,
    startReason: 'wanted_something_meaningful'
  }
] satisfies DiscoverPrompt[]

export type DiscoverPromptKey = (typeof DISCOVER_PROMPTS)[number]['key']

export function findPrompt(key: string | null | undefined): DiscoverPrompt | null {
  return DISCOVER_PROMPTS.find((prompt) => prompt.key === key) ?? null
}

/** The first prompt that covers a mood or reason key (used by the dashboard's "See more"). */
export function promptForMoodOrReason(key: string): DiscoverPrompt | null {
  return (
    DISCOVER_PROMPTS.find(
      (prompt) => (prompt.moods as string[]).includes(key) || prompt.reasons.includes(key)
    ) ?? null
  )
}

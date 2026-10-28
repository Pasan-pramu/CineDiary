import type { TitleStatus } from './types'

export const APP_NAME = 'CineDiary'

export const STATUS_LABELS: Record<TitleStatus, string> = {
  planned: 'Planned',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  rewatching: 'Rewatching'
}

export const DEFAULT_REASONS = [
  'Happy',
  'Sad',
  'Lonely',
  'Stressed',
  'Demotivated',
  'Needed motivation',
  'Needed relaxation',
  'Wanted to laugh',
  'Wanted adrenaline',
  'Needed an escape',
  'Wanted something meaningful',
  'Wanted inspiration',
  'Wanted adventure',
  'Curious',
  'Recommended by someone',
  'Rewatch',
  'Other'
] as const

export const NAV_ITEMS = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'My Collection', path: '/collection', icon: 'library' },
  { label: 'My Cinema Journal', path: '/journal', icon: 'journal' },
  { label: 'Insights', path: '/insights', icon: 'statistics' },
  { label: 'Discover', path: '/discover', icon: 'discover' },
  { label: 'My Timeline', path: '/timeline', icon: 'timeline' }
] as const

/**
 * The built-in moods. They live in the `moods` table (seeded by migration 0005), where you can
 * rename, reorder, hide and add your own (Settings → Moods & reasons). This list is only the
 * starting point and is used by tests; the app reads moods from the database.
 */
export const DEFAULT_MOODS = [
  { key: 'very_happy', label: 'Very happy', emoji: '😄' },
  { key: 'happy', label: 'Happy', emoji: '🙂' },
  { key: 'neutral', label: 'Neutral', emoji: '😐' },
  { key: 'sad', label: 'Sad', emoji: '😔' },
  { key: 'stressed', label: 'Stressed', emoji: '😩' },
  { key: 'demotivated', label: 'Demotivated', emoji: '😞' },
  { key: 'bored', label: 'Bored', emoji: '😴' },
  { key: 'lonely', label: 'Lonely', emoji: '❤️' },
  { key: 'overwhelmed', label: 'Overwhelmed', emoji: '🤯' },
  { key: 'calm', label: 'Calm', emoji: '😌' }
] as const

/** A mood's key, e.g. 'stressed' or a custom one like 'nostalgic_1a2b3c4d'. Keys never change. */
export type MoodKey = string

/** A local calendar date as YYYY-MM-DD (today by default). */
export function getLocalDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

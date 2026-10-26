export const APP_NAME = 'CineDiary'

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
  { label: 'Library', path: '/library', icon: 'library' },
  { label: 'Add Title', path: '/add-title', icon: 'add' },
  { label: 'Watch History', path: '/watch-history', icon: 'history' },
  { label: 'Statistics', path: '/statistics', icon: 'statistics' }
] as const

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
  { label: 'My Collection', path: '/collection', icon: 'library' },
  { label: 'My Cinema Journal', path: '/journal', icon: 'journal' },
  { label: 'Insights', path: '/insights', icon: 'statistics' },
  { label: 'Discover', path: '/discover', icon: 'discover' },
  { label: 'My Timeline', path: '/timeline', icon: 'timeline' }
] as const

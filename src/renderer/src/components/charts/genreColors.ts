// Gives every genre the same chart color everywhere (Insights, Dashboard, any period).
// Returns a slot index into ChartColors.genres (8 slots, --color-chart-1…8).

/** The most common genres get their own slot, so they never share a color. */
const FIXED_SLOTS: Record<string, number> = {
  drama: 0,
  action: 1,
  documentary: 2,
  comedy: 3,
  romance: 4,
  animation: 5,
  scifi: 6,
  sciencefiction: 6,
  thriller: 7
}

export const GENRE_SLOT_COUNT = 8

function normalize(genre: string): string {
  return genre.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Any other genre gets a slot from a hash of its name: always the same, but may be shared. */
export function genreColorSlot(genre: string): number {
  const key = normalize(genre)
  const fixed = FIXED_SLOTS[key]
  if (fixed !== undefined) return fixed
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % GENRE_SLOT_COUNT
}

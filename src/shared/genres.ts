/** Genres that mean the same thing but are spelled differently. */
const GENRE_ALIASES = [['sciencefiction', 'scifi']]

/** A genre's matching key: lower case, letters and digits only, aliases folded together. */
export function genreKey(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return GENRE_ALIASES.find((group) => group.includes(key))?.[0] ?? key
}

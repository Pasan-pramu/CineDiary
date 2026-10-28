// LIKE patterns with the user's text taken literally: %, _ and \ are escaped.
// Use with `ESCAPE '\'` in the SQL.

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/** "%text%" for a contains-match. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`
}

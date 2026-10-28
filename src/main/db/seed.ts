import { eq, sql } from 'drizzle-orm'
import { getDatabase } from './client'
import { reasons } from './schema'
import { DEFAULT_REASONS } from '../../shared/constants'

function reasonKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Adds any missing built-in reason (a new install starts with all of them, alphabetically).
 * Existing ones are left alone, including renamed or hidden ones.
 */
export function seedDefaultReasons(): void {
  const database = getDatabase()
  const after =
    database
      .select({ max: sql<number | null>`max(${reasons.sortOrder})` })
      .from(reasons)
      .get()?.max ?? 0
  // Inserted in the list's order (stable ids), placed alphabetically after any existing ones.
  const alphabetical = [...DEFAULT_REASONS].sort((a, b) => a.localeCompare(b))
  for (const label of DEFAULT_REASONS) {
    const key = reasonKey(label)
    const existing = database
      .select({ id: reasons.id })
      .from(reasons)
      .where(eq(reasons.key, key))
      .get()
    if (!existing) {
      const sortOrder = after + 1 + alphabetical.indexOf(label)
      database.insert(reasons).values({ key, label, isCustom: false, sortOrder }).run()
    }
  }
}

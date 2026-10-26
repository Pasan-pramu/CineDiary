import { eq } from 'drizzle-orm'
import { getDatabase } from './client'
import { reasons } from './schema'
import { DEFAULT_REASONS } from '../../shared/constants'

function reasonKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function seedDefaultReasons(): void {
  const database = getDatabase()
  for (const label of DEFAULT_REASONS) {
    const key = reasonKey(label)
    const existing = database
      .select({ id: reasons.id })
      .from(reasons)
      .where(eq(reasons.key, key))
      .get()
    if (!existing) {
      database.insert(reasons).values({ key, label, isCustom: false }).run()
    }
  }
}

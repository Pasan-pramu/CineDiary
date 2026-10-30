import type Database from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

/**
 * Runs the migrations with foreign keys OFF. Some migrations rebuild a table (that's the only
 * way SQLite can add a CHECK); with foreign keys on, dropping the old table would cascade-delete
 * every row that points at it. Foreign keys can only be switched outside a transaction, so it
 * happens here, around drizzle's migration transaction. Afterwards every reference must still
 * be valid, then foreign keys are back on. No Electron imports, so tests use it too.
 */
export function runMigrations<TSchema extends Record<string, unknown>>(
  sqlite: Database.Database,
  database: BetterSQLite3Database<TSchema>,
  migrationsFolder: string
): void {
  sqlite.pragma('foreign_keys = OFF')
  try {
    try {
      migrate(database, { migrationsFolder })
    } catch (error) {
      // Drizzle's message is only the SQL; SQLite's reason (e.g. which CHECK failed) is the cause.
      const reason = error instanceof Error && error.cause instanceof Error ? error.cause : error
      throw new Error(
        `The database upgrade stopped and changed nothing: ${reason instanceof Error ? reason.message : String(reason)}`,
        { cause: error }
      )
    }
    const broken = sqlite.pragma('foreign_key_check') as unknown[]
    if (broken.length) throw new Error(`Migration left ${broken.length} broken references.`)
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

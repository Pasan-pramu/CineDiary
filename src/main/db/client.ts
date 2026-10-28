import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { dataFolder } from '../dataFolder'

export type CineDiaryDatabase = BetterSQLite3Database<typeof schema>

let database: CineDiaryDatabase | null = null
let sqlite: Database.Database | null = null

function resolveMigrationsPath(): string {
  const candidates = [
    process.env['CINEDIARY_MIGRATIONS_DIR'],
    app.isPackaged ? join(process.resourcesPath, 'migrations') : undefined,
    join(__dirname, 'migrations'),
    join(app.getAppPath(), 'src', 'main', 'db', 'migrations'),
    join(process.cwd(), 'src', 'main', 'db', 'migrations')
  ].filter((path): path is string => Boolean(path))

  const path = candidates.find((candidate) => existsSync(join(candidate, 'meta')))
  if (!path) {
    throw new Error(
      `Could not find CineDiary database migrations. Checked:\n${candidates.join('\n')}`
    )
  }
  return path
}

export function getDatabase(): CineDiaryDatabase {
  if (!database) {
    throw new Error('Database has not been initialized')
  }
  return database
}

export function initializeDatabase(): { databasePath: string; migrationsPath: string } {
  if (database && sqlite) {
    return {
      databasePath: sqlite.name,
      migrationsPath: resolveMigrationsPath()
    }
  }

  const databasePath = join(dataFolder(), 'cinediary.db')
  mkdirSync(dataFolder(), { recursive: true })
  sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  database = drizzle(sqlite, { schema })

  const migrationsPath = resolveMigrationsPath()
  migrate(database, { migrationsFolder: migrationsPath })

  return { databasePath, migrationsPath }
}

/** The raw better-sqlite3 handle (used for SQLite's backup API and exports). */
export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database has not been initialized')
  return sqlite
}

/** How many migrations this version of the app knows: our schema version. */
export function getSupportedSchemaVersion(): number {
  const journal = JSON.parse(
    readFileSync(join(resolveMigrationsPath(), 'meta', '_journal.json'), 'utf8')
  ) as { entries: unknown[] }
  return journal.entries.length
}

export function closeDatabase(): void {
  sqlite?.close()
  sqlite = null
  database = null
}

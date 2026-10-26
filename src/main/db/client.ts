import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

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

  const databasePath = join(app.getPath('userData'), 'cinediary.db')
  mkdirSync(app.getPath('userData'), { recursive: true })
  sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  database = drizzle(sqlite, { schema })

  const migrationsPath = resolveMigrationsPath()
  migrate(database, { migrationsFolder: migrationsPath })

  return { databasePath, migrationsPath }
}

export function closeDatabase(): void {
  sqlite?.close()
  sqlite = null
  database = null
}

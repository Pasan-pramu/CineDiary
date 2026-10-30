/* eslint-disable @typescript-eslint/explicit-function-return-type -- a plain JS dev script */
// Lists mood scores and personal ratings outside 1–10 (or not whole numbers) in a diary,
// before upgrading to 1.1.0, whose migration 0006 only accepts 1–10.
//
//   npm run check:scores -- "%APPDATA%\cinediary\cinediary.db"
//
// Opens the database READ-ONLY and changes nothing. Close CineDiary first. Runs under
// Electron's Node (better-sqlite3 is compiled for Electron), like `npm test`.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

if (!process.env.ELECTRON_RUN_AS_NODE) {
  const result = spawnSync(
    require('electron'),
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
  )
  process.exit(result.status ?? 1)
}

const target = process.argv[2]
if (!target || !existsSync(resolve(target))) {
  console.error('Usage: npm run check:scores -- <path to cinediary.db>')
  process.exit(1)
}

const Database = require('better-sqlite3')
const db = new Database(resolve(target), { readonly: true, fileMustExist: true })
const outOfRange = (column) =>
  `${column} IS NOT NULL AND (typeof(${column}) != 'integer' OR ${column} NOT BETWEEN 1 AND 10)`

const scores = db
  .prepare(
    `SELECT t.title, we.id, coalesce(we.completed_at, we.started_at) AS date,
       we.mood_before_score AS before, we.mood_after_score AS after
     FROM watch_entries we JOIN titles t ON t.id = we.title_id
     WHERE (${outOfRange('we.mood_before_score')}) OR (${outOfRange('we.mood_after_score')})
     ORDER BY date`
  )
  .all()
const ratings = db
  .prepare(`SELECT id, title, rating FROM titles WHERE ${outOfRange('rating')} ORDER BY title`)
  .all()
db.close()

if (!scores.length && !ratings.length) {
  console.log('All mood scores and ratings are whole numbers from 1 to 10. Safe to upgrade.')
  process.exit(0)
}
for (const row of scores)
  console.log(
    `Watch ${row.id} of "${row.title}" (${row.date}): before ${row.before ?? '–'}, after ${row.after ?? '–'}`
  )
for (const row of ratings) console.log(`Title ${row.id} "${row.title}": rating ${row.rating}`)
console.log(
  `\n${scores.length} watch(es) and ${ratings.length} title(s) need fixing in the app before upgrading.`
)
process.exit(2)

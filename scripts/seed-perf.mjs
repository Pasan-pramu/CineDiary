/* eslint-disable @typescript-eslint/explicit-function-return-type -- a plain JS dev script */
// Dev-only: builds a large made-up diary for performance checks.
//
//   npm run seed:perf -- <new folder>
//   npx electron . --user-data-dir=<that folder>
//
// It only ever creates a NEW database in an empty (or missing) folder and refuses anything
// else, so it can't touch your real diary. Runs under Electron's Node (better-sqlite3 is
// compiled for Electron), like `npm test`.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

if (!process.env.ELECTRON_RUN_AS_NODE) {
  const result = spawnSync(
    require('electron'),
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    }
  )
  process.exit(result.status ?? 1)
}

const target = process.argv[2]
if (!target) {
  console.error('Usage: npm run seed:perf -- <new folder>')
  process.exit(1)
}
const folder = resolve(target)
if (existsSync(folder) && readdirSync(folder).length > 0) {
  console.error(`Refusing: ${folder} is not empty. Pick a new, empty folder.`)
  process.exit(1)
}
mkdirSync(folder, { recursive: true })

const Database = require('better-sqlite3')
const { drizzle } = await import('drizzle-orm/better-sqlite3')
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')

const TITLES = Number(process.env.SEED_TITLES ?? 1000)
const WATCHES = Number(process.env.SEED_WATCHES ?? 2000)
const file = join(folder, 'cinediary.db')
const sqlite = new Database(file)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
migrate(drizzle(sqlite), {
  migrationsFolder: fileURLToPath(new URL('../src/main/db/migrations', import.meta.url))
})

// A small deterministic random generator, so every run builds the same diary.
let seed = 42
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32
  return seed / 2 ** 32
}
const pick = (list) => list[Math.floor(random() * list.length)]
const between = (low, high) => low + Math.floor(random() * (high - low + 1))
const day = (offset) => {
  const date = new Date(Date.UTC(2016, 0, 1) + offset * 86_400_000)
  return date.toISOString().slice(0, 10)
}
const now = new Date().toISOString()

const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller'
]
const MOODS = [
  'very_happy',
  'happy',
  'neutral',
  'sad',
  'stressed',
  'demotivated',
  'bored',
  'lonely',
  'overwhelmed',
  'calm'
]
const REASONS = [
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
]
const WORDS = [
  'Night',
  'River',
  'Summer',
  'Echo',
  'Paper',
  'Silent',
  'Golden',
  'Last',
  'City',
  'Garden',
  'Winter',
  'Signal',
  'Harbor',
  'Lantern',
  'Orbit',
  'Velvet',
  'Hollow',
  'Northern'
]
const NAMES = [
  'Alex Morgan',
  'Sam Rivera',
  'Jamie Chen',
  'Robin Patel',
  'Kai Nakamura',
  'Noor Haddad',
  'Lena Fischer',
  'Tomás Silva',
  'Ama Mensah',
  'Ivy Laurent'
]

const insertMany = sqlite.transaction(() => {
  const genre = sqlite.prepare('INSERT INTO genres (name) VALUES (?)')
  GENRES.forEach((name) => genre.run(name))
  const reason = sqlite.prepare('INSERT INTO reasons (key, label, is_custom) VALUES (?, ?, 0)')
  REASONS.forEach((label) =>
    reason.run(
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
      label
    )
  )

  const title = sqlite.prepare(`INSERT INTO titles (type, title, year, overview, runtime_minutes,
    total_seasons, total_episodes, status, rating, is_favorite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?)`)
  const titleGenre = sqlite.prepare('INSERT OR IGNORE INTO title_genres VALUES (?, ?)')
  const cast = sqlite.prepare(
    'INSERT INTO title_cast (title_id, name, character, "order") VALUES (?, ?, ?, ?)'
  )
  const crew = sqlite.prepare(
    'INSERT INTO title_crew (title_id, name, role, "order") VALUES (?, ?, ?, 0)'
  )
  for (let id = 1; id <= TITLES; id++) {
    const series = random() < 0.3
    title.run(
      series ? 'series' : 'movie',
      `${pick(WORDS)} ${pick(WORDS)} ${id}`,
      between(1970, 2026),
      'A made-up story for performance testing.',
      series ? between(22, 60) : between(80, 180),
      series ? between(1, 6) : null,
      series ? between(6, 80) : null,
      random() < 0.6 ? between(4, 10) : null,
      random() < 0.1 ? 1 : 0,
      now,
      now
    )
    for (let g = 0; g < between(1, 3); g++) titleGenre.run(id, between(1, GENRES.length))
    for (let c = 0; c < 6; c++) cast.run(id, pick(NAMES), `Role ${c + 1}`, c)
    crew.run(id, pick(NAMES), series ? 'creator' : 'director')
  }

  const watch = sqlite.prepare(`INSERT INTO watch_entries (title_id, started_at, completed_at,
    is_rewatch, episodes_watched, mood_before, mood_before_score, reason_note, mood_after,
    mood_after_score, thoughts, is_highlight, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const watchReason = sqlite.prepare('INSERT OR IGNORE INTO watch_entry_reasons VALUES (?, ?)')
  const watched = new Map()
  for (let n = 0; n < WATCHES; n++) {
    const titleId = between(1, TITLES)
    const start = between(0, 3920) // 2016 … late 2026
    const open = n >= WATCHES - 20
    const scored = random() < 0.8
    const before = scored ? between(1, 8) : null
    const id = watch.run(
      titleId,
      day(start),
      open ? null : day(start + between(0, 20)),
      watched.has(titleId) ? 1 : 0,
      between(0, 30),
      random() < 0.85 ? pick(MOODS) : null,
      before,
      random() < 0.3 ? 'Needed something for a long evening.' : null,
      random() < 0.8 ? pick(MOODS) : null,
      scored ? Math.min(10, before + between(-2, 5)) : null,
      random() < 0.4 ? `Memory ${n}: it stayed with me for days.` : null,
      random() < 0.03 ? 1 : 0,
      now,
      now
    ).lastInsertRowid
    watched.set(titleId, (watched.get(titleId) ?? 0) + 1)
    for (let r = 0; r < between(0, 3); r++) watchReason.run(id, between(1, REASONS.length))
  }
  // Statuses follow the watches, like the app does.
  sqlite.exec(`UPDATE titles SET status = CASE
    WHEN EXISTS (SELECT 1 FROM watch_entries w WHERE w.title_id = titles.id AND w.completed_at IS NULL)
      THEN 'watching'
    WHEN EXISTS (SELECT 1 FROM watch_entries w WHERE w.title_id = titles.id) THEN 'completed'
    ELSE 'planned' END`)

  const chapter = sqlite.prepare(`INSERT INTO life_periods (name, start_date, end_date, color,
    note, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)`)
  const chapters = [
    ['University', '2016-09-01', '2020-06-30', 'violet'],
    ['Lockdown', '2020-03-15', '2021-06-30', 'rose'],
    ['First job', '2020-08-01', '2023-12-31', 'blue'],
    ['Living abroad', '2022-05-01', '2023-08-31', 'teal'],
    ['New city', '2024-01-01', null, 'green'],
    ['Summer break', '2025-06-01', '2025-08-31', 'amber']
  ]
  for (const [name, start, end, color] of chapters) chapter.run(name, start, end, color, now, now)
})
insertMany()

const count = (table) => sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n
console.log(`Created ${file}`)
console.log(
  `${count('titles')} titles, ${count('watch_entries')} watches, ${count('title_cast')} cast, ` +
    `${count('watch_entry_reasons')} watch reasons, ${count('life_periods')} chapters`
)
sqlite.close()

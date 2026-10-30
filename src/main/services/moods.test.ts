import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MOODS } from '../../shared/constants'
import type { CineDiaryDatabase } from '../db/client'
import {
  closeMemoryDatabase,
  insertReasons,
  insertTitle,
  insertWatch,
  openMemoryDatabase
} from '../test/memoryDb'
import { createBackup, inspectBackup, restoreFromStaging } from './backup'
import { buildJsonExport, buildWatchesCsv } from './export'
import { getFeelings } from './feelings'
import { createMood, deleteMood, listMoods, reorderMoods, setMoodHidden, updateMood } from './moods'
import { createReason, deleteReason, listReasons, setReasonHidden } from './reasons'
import { getRecommendationOptions, recommend } from './recommendations'
import { searchJournal, startWatch } from './watchEntries'
import { runMigrations } from '../db/migrate'

// Custom moods and reasons (M11b): seeding, delete rules, hidden items. In-memory and temporary
// databases only; no real diary.

vi.mock('../db/client', async (original) => ({
  ...(await original<typeof import('../db/client')>()),
  getDatabase: (await import('../test/memoryDb')).currentDatabase
}))

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const TODAY = '2026-10-28'
const temp: string[] = []
afterEach(() => {
  for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true })
})
function tempDir(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `cinediary-${name}-`))
  temp.push(dir)
  return dir
}

/** The migrations as they were before 0005 (no moods table), for "old diary" databases. */
function migrationsBefore0005(): string {
  const dir = tempDir('old-migrations')
  cpSync(MIGRATIONS, dir, { recursive: true })
  rmSync(join(dir, '0005_custom_moods.sql'))
  rmSync(join(dir, 'meta', '0005_snapshot.json'))
  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] }
  journal.entries = journal.entries.slice(0, 5)
  writeFileSync(journalPath, JSON.stringify(journal))
  return dir
}

/** An old diary: two watches with moods and reasons, saved before custom moods existed. */
function fillOldDiary(sqlite: Database.Database): void {
  const now = '2026-01-01T00:00:00.000Z'
  sqlite
    .prepare(
      "INSERT INTO titles (id, type, title, status, created_at, updated_at) VALUES (1, 'movie', 'Paddington 2', 'completed', ?, ?)"
    )
    .run(now, now)
  sqlite
    .prepare(
      "INSERT INTO reasons (id, key, label, is_custom) VALUES (1, 'stressed', 'Stressed', 0), (2, 'rainy_day_1a2b3c4d', 'Rainy day', 1)"
    )
    .run()
  const watch = sqlite.prepare(
    `INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before, mood_before_score,
      mood_after, mood_after_score, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  watch.run(1, '2026-10-01', '2026-10-01', 'stressed', 3, 'calm', 8, now, now)
  watch.run(2, '2026-10-05', '2026-10-05', 'lonely', 4, 'happy', 6, now, now)
  sqlite.prepare('INSERT INTO watch_entry_reasons VALUES (1, 1), (2, 2)').run()
}

function expectOldDiaryIntact(db: CineDiaryDatabase): void {
  // The 10 built-in moods, in order, with their labels and emoji.
  expect(
    listMoods(db).map(({ key, label, emoji, isCustom }) => ({ key, label, emoji, isCustom }))
  ).toEqual(DEFAULT_MOODS.map((mood) => ({ ...mood, isCustom: false })))
  // Old watches keep their moods (now with labels from the table) and reasons.
  const feelings = getFeelings({ kind: 'range', from: '2026-10-01', to: '2026-10-31' }, db, TODAY)
  expect(feelings.moodBefore.items.map((item) => [item.label, item.watches])).toEqual([
    ['Lonely', 1],
    ['Stressed', 1]
  ])
  expect(feelings.moodAfter.items.map((item) => item.label).sort()).toEqual(['Calm', 'Happy'])
  expect(feelings.reasons.items.map((item) => item.label).sort()).toEqual(['Rainy day', 'Stressed'])
}

describe('migration 0005', () => {
  it('seeds the 10 built-in moods and keeps old entries working', () => {
    const sqlite = new Database(':memory:')
    const db = drizzle(sqlite)
    runMigrations(sqlite, db, migrationsBefore0005())
    fillOldDiary(sqlite)
    runMigrations(sqlite, db, MIGRATIONS)
    expectOldDiaryIntact(drizzle(sqlite) as unknown as CineDiaryDatabase)
    // Reasons keep their alphabetical order.
    expect(
      listReasons(drizzle(sqlite) as unknown as CineDiaryDatabase).map((r) => r.label)
    ).toEqual(['Rainy day', 'Stressed'])
    sqlite.close()
  })

  it('turns a mood key no built-in mood knows into a custom mood, so nothing is lost', () => {
    const sqlite = new Database(':memory:')
    runMigrations(sqlite, drizzle(sqlite), migrationsBefore0005())
    fillOldDiary(sqlite)
    sqlite.prepare("UPDATE watch_entries SET mood_after = 'mystery' WHERE id = 2").run()
    runMigrations(sqlite, drizzle(sqlite), MIGRATIONS)
    const mystery = listMoods(drizzle(sqlite) as unknown as CineDiaryDatabase).find(
      (mood) => mood.key === 'mystery'
    )
    expect(mystery).toMatchObject({ label: 'mystery', isCustom: true, uses: 1 })
    sqlite.close()
  })

  it('restoring a backup made before 0005 migrates it: moods seeded, entries intact', async () => {
    // A diary and its backup from before custom moods.
    const oldDir = tempDir('old-diary')
    const old = new Database(join(oldDir, 'cinediary.db'))
    runMigrations(old, drizzle(old), migrationsBefore0005())
    fillOldDiary(old)
    for (const folder of ['posters', 'backdrops', 'banners']) await mkdir(join(oldDir, folder))
    const zip = join(tempDir('zips'), 'CineDiary-backup.zip')
    await createBackup({
      db: old,
      dataDir: oldDir,
      outFile: zip,
      appVersion: '1.0.0',
      kind: 'manual'
    })
    old.close()

    // Today's app (all migrations) restores it…
    const current = tempDir('current')
    const db = new Database(join(current, 'cinediary.db'))
    runMigrations(db, drizzle(db), MIGRATIONS)
    const supported = (
      JSON.parse(readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')) as {
        entries: unknown[]
      }
    ).entries.length
    const staging = join(current, 'restore-staging')
    await inspectBackup(zip, staging, supported)
    await restoreFromStaging({
      stagingDir: staging,
      dataDir: current,
      asideDir: join(current, 'restore-previous'),
      closeDatabase: () => db.close(),
      reopenDatabase: () => undefined
    })

    // …and opens it the way the app starts: migrations run on the restored database.
    const restored = new Database(join(current, 'cinediary.db'))
    runMigrations(restored, drizzle(restored), MIGRATIONS)
    expectOldDiaryIntact(drizzle(restored) as unknown as CineDiaryDatabase)
    restored.close()
  })
})

describe('moods and reasons', () => {
  let db: CineDiaryDatabase
  let sqlite: Database.Database

  beforeEach(() => {
    ;({ db, sqlite } = openMemoryDatabase())
    insertReasons(['Stressed', 'Needed an escape'])
    insertTitle({ id: 1, status: 'completed' })
    insertWatch({
      id: 1,
      titleId: 1,
      started: '2026-10-02',
      moodBefore: 'stressed',
      before: 3,
      moodAfter: 'calm',
      after: 8,
      reasons: [1]
    })
  })
  afterEach(() => closeMemoryDatabase())

  const mood = (key: string): ReturnType<typeof listMoods>[number] =>
    listMoods(db).find((item) => item.key === key)!

  it('counts how many watches use each one', () => {
    expect(mood('stressed').uses).toBe(1)
    expect(mood('calm').uses).toBe(1)
    expect(mood('happy').uses).toBe(0)
    expect(
      Object.fromEntries(listReasons(db).map((reason) => [reason.label, reason.uses]))
    ).toEqual({ Stressed: 1, 'Needed an escape': 0 })
  })

  it('a custom mood can be created, renamed and used for a watch', () => {
    const nostalgic = createMood({ label: 'Nostalgic', emoji: '🥹' }, db)
    expect(nostalgic).toMatchObject({ isCustom: true, isHidden: false, uses: 0 })
    expect(nostalgic.key).toMatch(/^nostalgic_[0-9a-f]{8}$/)
    expect(listMoods(db).at(-1)?.key).toBe(nostalgic.key)

    const renamed = updateMood(nostalgic.id, { label: 'Wistful', emoji: '🌧️' }, db)
    expect(renamed).toMatchObject({ key: nostalgic.key, label: 'Wistful', emoji: '🌧️' })

    insertTitle({ id: 2, status: 'planned' })
    startWatch({ titleId: 2, startedAt: '2026-10-20', moodBefore: nostalgic.key })
    expect(mood(nostalgic.key).uses).toBe(1)
  })

  it('rejects a watch with a mood that does not exist', () => {
    insertTitle({ id: 2, status: 'planned' })
    expect(() =>
      startWatch({ titleId: 2, startedAt: '2026-10-20', moodBefore: 'made_up' })
    ).toThrow(/Unknown mood/)
  })

  it('refuses two moods or two reasons with the same name', () => {
    expect(() => createMood({ label: 'calm', emoji: '🙂' }, db)).toThrow(/already have a mood/)
    expect(() => createReason('STRESSED', db)).toThrow(/already have a reason/)
  })

  it('never deletes a mood or reason a watch uses; built-in ones can only be hidden', () => {
    const used = createMood({ label: 'Nostalgic', emoji: '🥹' }, db)
    insertTitle({ id: 2, status: 'planned' })
    startWatch({ titleId: 2, startedAt: '2026-10-20', moodBefore: used.key })
    expect(() => deleteMood(used.id, db)).toThrow(/Hide it instead/)
    expect(() => deleteMood(mood('happy').id, db)).toThrow(/can be hidden, but not deleted/)

    const usedReason = createReason('Rainy day', db)
    sqlite.prepare('INSERT INTO watch_entry_reasons VALUES (1, ?)').run(usedReason.id)
    expect(() => deleteReason(usedReason.id, db)).toThrow(/Hide it instead/)
    expect(() => deleteReason(1, db)).toThrow(/can be hidden, but not deleted/)
    expect(listMoods(db).some((item) => item.id === used.id)).toBe(true)
  })

  it('deletes an unused custom mood or reason', () => {
    const unused = createMood({ label: 'Curious', emoji: '🤔' }, db)
    deleteMood(unused.id, db)
    expect(listMoods(db).some((item) => item.id === unused.id)).toBe(false)
    const reason = createReason('Rainy day', db)
    deleteReason(reason.id, db)
    expect(listReasons(db).some((item) => item.id === reason.id)).toBe(false)
  })

  it('reorders when every id is listed once', () => {
    const ids = listMoods(db).map((item) => item.id)
    const reversed = [...ids].reverse()
    expect(reorderMoods(reversed, db).map((item) => item.id)).toEqual(reversed)
    expect(() => reorderMoods(ids.slice(1), db)).toThrow(/every mood once/)
  })

  describe('hidden ones', () => {
    beforeEach(() => {
      setMoodHidden(mood('stressed').id, true, db)
      setReasonHidden(1, true, db)
    })

    it('stay in the lists (marked hidden), so pickers can leave them out', () => {
      expect(mood('stressed').isHidden).toBe(true)
      expect(listReasons(db).find((reason) => reason.id === 1)).toMatchObject({
        label: 'Stressed',
        isHidden: true
      })
    })

    it('still count in Insights', () => {
      const feelings = getFeelings('all', db, TODAY)
      expect(feelings.moodBefore.items[0]).toMatchObject({ label: 'Stressed', watches: 1 })
      expect(feelings.reasons.items[0]).toMatchObject({ label: 'Stressed', watches: 1 })
    })

    it('still work as Journal filters', () => {
      const query = {
        search: '',
        type: 'all' as const,
        reasonId: null,
        moodBefore: null,
        moodImproved: false,
        hasReflection: false,
        chapterId: null,
        feelingOrReason: null
      }
      expect(searchJournal({ ...query, moodBefore: 'stressed' }).total).toBe(1)
      expect(searchJournal({ ...query, reasonId: 1 }).total).toBe(1)
      expect(searchJournal({ ...query, feelingOrReason: 'stressed' }).total).toBe(1)
    })

    it('are no longer offered on Home ("What should I watch?"), but still recommend', () => {
      // Two scored "stressed" watches make it an option, unless the mood is hidden.
      insertWatch({
        id: 2,
        titleId: 1,
        started: '2026-10-03',
        moodBefore: 'stressed',
        before: 2,
        after: 7
      })
      expect(getRecommendationOptions().some((option) => option.key === 'stressed')).toBe(false)
      setMoodHidden(mood('stressed').id, false, db)
      expect(getRecommendationOptions().some((option) => option.key === 'stressed')).toBe(true)
      // The history itself still counts (e.g. an old link or Discover).
      expect(recommend({ mood: 'stressed', reasonKey: null, type: 'all' }, db).enoughData).toBe(
        true
      )
    })

    it('still appear in the JSON and CSV exports', () => {
      const json = buildJsonExport(sqlite, '1.0.0') as {
        moods: Array<{ key: string; isHidden: boolean }>
        reasons: Array<{ label: string; isHidden: boolean }>
        titles: Array<{ watches: Array<{ moodBeforeLabel: string; reasons: string[] }> }>
      }
      expect(json.moods.find((item) => item.key === 'stressed')?.isHidden).toBe(true)
      expect(json.reasons.find((item) => item.label === 'Stressed')?.isHidden).toBe(true)
      expect(json.titles[0].watches[0]).toMatchObject({
        moodBeforeLabel: 'Stressed',
        reasons: ['Stressed']
      })
      const csv = buildWatchesCsv(sqlite)
      expect(csv).toContain(',Stressed,3,Calm,8,')
    })
  })
})

import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import type { Mood, MoodInput } from '../../shared/types'

// Moods (Settings → Moods & reasons). Entries store a mood's key, which never changes, so
// renaming, new emoji, reordering and hiding never touch old entries. Only custom moods that no
// watch uses can be deleted; everything else can only be hidden.

interface MoodRow {
  id: number
  key: string
  label: string
  emoji: string
  isCustom: number
  isHidden: number
  sortOrder: number
  uses: number
}

const SELECT_MOODS = sql`
  SELECT m.id AS "id", m.key AS "key", m.label AS "label", m.emoji AS "emoji",
    m.is_custom AS "isCustom", m.is_hidden AS "isHidden", m.sort_order AS "sortOrder",
    (SELECT count(*) FROM watch_entries we
      WHERE we.mood_before = m.key OR we.mood_after = m.key) AS "uses"
  FROM moods m`

function toMood(row: MoodRow): Mood {
  return { ...row, isCustom: Boolean(row.isCustom), isHidden: Boolean(row.isHidden) }
}

/** Every mood, hidden ones included (the UI decides where hidden ones appear). */
export function listMoods(db: CineDiaryDatabase = getDatabase()): Mood[] {
  return db.all<MoodRow>(sql`${SELECT_MOODS} ORDER BY m.sort_order, m.id`).map(toMood)
}

function getMood(id: number, db: CineDiaryDatabase): Mood {
  const row = db.get<MoodRow | undefined>(sql`${SELECT_MOODS} WHERE m.id = ${id}`)
  if (!row) throw new Error('Mood not found.')
  return toMood(row)
}

/** key → label, for stats, exports and "why" lines (unknown keys fall back to the key). */
export function moodLabels(db: CineDiaryDatabase = getDatabase()): Map<string, string> {
  return new Map(
    db
      .all<{ key: string; label: string }>(sql`SELECT key AS "key", label AS "label" FROM moods`)
      .map((row) => [row.key, row.label])
  )
}

export function isMoodKey(key: string, db: CineDiaryDatabase = getDatabase()): boolean {
  return Boolean(db.get<{ n: number }>(sql`SELECT count(*) AS "n" FROM moods WHERE key = ${key}`).n)
}

/** A readable, unique key for a new mood or reason: "nostalgic_1a2b3c4d". */
export function newKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${slug || 'custom'}_${randomUUID().slice(0, 8)}`
}

function assertUniqueLabel(label: string, exceptId: number | null, db: CineDiaryDatabase): void {
  const clash = db.get<{ id: number } | undefined>(sql`
    SELECT id AS "id" FROM moods
    WHERE lower(label) = lower(${label}) AND (${exceptId} IS NULL OR id != ${exceptId})`)
  if (clash) throw new Error(`You already have a mood called “${label}”.`)
}

export function createMood(input: MoodInput, db: CineDiaryDatabase = getDatabase()): Mood {
  assertUniqueLabel(input.label, null, db)
  const { next } = db.get<{ next: number }>(
    sql`SELECT coalesce(max(sort_order), 0) + 1 AS "next" FROM moods`
  )
  const { id } = db.get<{ id: number }>(sql`
    INSERT INTO moods (key, label, emoji, is_custom, is_hidden, sort_order)
    VALUES (${newKey(input.label)}, ${input.label}, ${input.emoji}, 1, 0, ${next})
    RETURNING id AS "id"`)
  return getMood(id, db)
}

export function updateMood(
  id: number,
  input: MoodInput,
  db: CineDiaryDatabase = getDatabase()
): Mood {
  getMood(id, db)
  assertUniqueLabel(input.label, id, db)
  db.run(sql`UPDATE moods SET label = ${input.label}, emoji = ${input.emoji} WHERE id = ${id}`)
  return getMood(id, db)
}

export function setMoodHidden(
  id: number,
  hidden: boolean,
  db: CineDiaryDatabase = getDatabase()
): Mood {
  getMood(id, db)
  db.run(sql`UPDATE moods SET is_hidden = ${hidden ? 1 : 0} WHERE id = ${id}`)
  return getMood(id, db)
}

/** Saves a new order; `ids` must list every mood exactly once. */
export function reorderMoods(ids: number[], db: CineDiaryDatabase = getDatabase()): Mood[] {
  const all = listMoods(db).map((mood) => mood.id)
  if (
    ids.length !== all.length ||
    new Set(ids).size !== ids.length ||
    !all.every((id) => ids.includes(id))
  )
    throw new Error('The new order must list every mood once.')
  db.transaction((tx) => {
    ids.forEach((id, index) =>
      tx.run(sql`UPDATE moods SET sort_order = ${index + 1} WHERE id = ${id}`)
    )
  })
  return listMoods(db)
}

/** Only an unused custom mood can be deleted; anything else can only be hidden. */
export function deleteMood(id: number, db: CineDiaryDatabase = getDatabase()): void {
  const mood = getMood(id, db)
  if (!mood.isCustom) throw new Error('Built-in moods can be hidden, but not deleted.')
  if (mood.uses > 0)
    throw new Error(
      `“${mood.label}” is used by ${mood.uses} ${mood.uses === 1 ? 'watch' : 'watches'}. Hide it instead.`
    )
  db.run(sql`DELETE FROM moods WHERE id = ${id}`)
}

import { sql } from 'drizzle-orm'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { newKey } from './moods'
import type { ReasonOption } from '../../shared/types'

// Reasons for watching (Settings → Moods & reasons). Same rules as moods: renaming keeps the
// key, hidden ones stay on old entries, and only unused custom reasons can be deleted.

interface ReasonRow {
  id: number
  key: string
  label: string
  isCustom: number
  isHidden: number
  sortOrder: number
  uses: number
}

const SELECT_REASONS = sql`
  SELECT r.id AS "id", r.key AS "key", r.label AS "label", r.is_custom AS "isCustom",
    r.is_hidden AS "isHidden", r.sort_order AS "sortOrder",
    (SELECT count(*) FROM watch_entry_reasons wer WHERE wer.reason_id = r.id) AS "uses"
  FROM reasons r`

function toReason(row: ReasonRow): ReasonOption {
  return { ...row, isCustom: Boolean(row.isCustom), isHidden: Boolean(row.isHidden) }
}

/** Every reason, hidden ones included, in your order. */
export function listReasons(db: CineDiaryDatabase = getDatabase()): ReasonOption[] {
  return db
    .all<ReasonRow>(sql`${SELECT_REASONS} ORDER BY r.sort_order, lower(r.label), r.id`)
    .map(toReason)
}

function getReason(id: number, db: CineDiaryDatabase): ReasonOption {
  const row = db.get<ReasonRow | undefined>(sql`${SELECT_REASONS} WHERE r.id = ${id}`)
  if (!row) throw new Error('Reason not found.')
  return toReason(row)
}

function assertUniqueLabel(label: string, exceptId: number | null, db: CineDiaryDatabase): void {
  const clash = db.get<{ id: number } | undefined>(sql`
    SELECT id AS "id" FROM reasons
    WHERE lower(label) = lower(${label}) AND (${exceptId} IS NULL OR id != ${exceptId})`)
  if (clash) throw new Error(`You already have a reason called “${label}”.`)
}

export function createReason(label: string, db: CineDiaryDatabase = getDatabase()): ReasonOption {
  assertUniqueLabel(label, null, db)
  const { next } = db.get<{ next: number }>(
    sql`SELECT coalesce(max(sort_order), 0) + 1 AS "next" FROM reasons`
  )
  const { id } = db.get<{ id: number }>(sql`
    INSERT INTO reasons (key, label, is_custom, is_hidden, sort_order)
    VALUES (${newKey(label)}, ${label}, 1, 0, ${next})
    RETURNING id AS "id"`)
  return getReason(id, db)
}

export function renameReason(
  id: number,
  label: string,
  db: CineDiaryDatabase = getDatabase()
): ReasonOption {
  getReason(id, db)
  assertUniqueLabel(label, id, db)
  db.run(sql`UPDATE reasons SET label = ${label} WHERE id = ${id}`)
  return getReason(id, db)
}

export function setReasonHidden(
  id: number,
  hidden: boolean,
  db: CineDiaryDatabase = getDatabase()
): ReasonOption {
  getReason(id, db)
  db.run(sql`UPDATE reasons SET is_hidden = ${hidden ? 1 : 0} WHERE id = ${id}`)
  return getReason(id, db)
}

/** Saves a new order; `ids` must list every reason exactly once. */
export function reorderReasons(
  ids: number[],
  db: CineDiaryDatabase = getDatabase()
): ReasonOption[] {
  const all = listReasons(db).map((reason) => reason.id)
  if (
    ids.length !== all.length ||
    new Set(ids).size !== ids.length ||
    !all.every((id) => ids.includes(id))
  )
    throw new Error('The new order must list every reason once.')
  db.transaction((tx) => {
    ids.forEach((id, index) =>
      tx.run(sql`UPDATE reasons SET sort_order = ${index + 1} WHERE id = ${id}`)
    )
  })
  return listReasons(db)
}

/** Only an unused custom reason can be deleted; anything else can only be hidden. */
export function deleteReason(id: number, db: CineDiaryDatabase = getDatabase()): void {
  const reason = getReason(id, db)
  if (!reason.isCustom) throw new Error('Built-in reasons can be hidden, but not deleted.')
  if (reason.uses > 0)
    throw new Error(
      `“${reason.label}” is used by ${reason.uses} ${reason.uses === 1 ? 'watch' : 'watches'}. Hide it instead.`
    )
  db.run(sql`DELETE FROM reasons WHERE id = ${id}`)
}

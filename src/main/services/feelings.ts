import { sql } from 'drizzle-orm'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { getLocalDate } from '../../shared/constants'
import type {
  ChapterAnalysis,
  DateRange,
  Distribution,
  DistributionItem,
  FeelingsAnalysis,
  InsightsPeriod,
  LifePeriod,
  OverTime,
  TimeBucket
} from '../../shared/types'
import {
  getGenres,
  getMoodOverview,
  MIN_MOOD_ENTRIES,
  rankTitles,
  resolvePeriod,
  withEntries
} from './stats'

// Feelings & life chapters (M10c), built on the stats engine's `done` set (finished watches in
// a range). "Feelings" = mood before (and after); "reasons" = why I watched.
// - Shares are of ALL finished watches in the range. Watches without a mood or reason are
//   counted as "Not recorded", never dropped. A watch can have several reasons, so reason
//   shares can add up to more than 100%.
// - A group's average mood change needs MIN_MOOD_ENTRIES watches with both scores.

export const NOT_RECORDED = 'Not recorded'

/** How many values the over-time charts follow. */
const OVER_TIME_TOP = 5
/** Ranges longer than this many months are charted per year. */
const LONG_RANGE_MONTHS = 24
const CHAPTER_TOP = 3

interface GroupRow {
  key: string | null
  label: string | null
  reasonId: number | null
  isCustom: number
  watches: number
  changeAverage: number | null
  changeN: number
}

function toItem(row: GroupRow, total: number): DistributionItem {
  return {
    key: row.key,
    label: row.key === null ? NOT_RECORDED : (row.label ?? row.key),
    reasonId: row.reasonId,
    isCustom: Boolean(row.isCustom),
    watches: row.watches,
    share: total ? row.watches / total : 0,
    averageChange: row.changeN >= MIN_MOOD_ENTRIES ? row.changeAverage : null,
    changeN: row.changeN
  }
}

/** Recorded groups by watches (then label), with "Not recorded" last when there is any. */
function toDistribution(recorded: GroupRow[], notRecorded: GroupRow, total: number): Distribution {
  const items = recorded
    .map((row) => toItem(row, total))
    .sort((a, b) => b.watches - a.watches || a.label.localeCompare(b.label))
  if (notRecorded.watches > 0) items.push(toItem(notRecorded, total))
  return { total, items }
}

const CHANGE = sql.raw(`avg(after_score - before_score) AS "changeAverage",
  count(after_score - before_score) AS "changeN"`)

function moodDistribution(
  column: 'mood_before' | 'mood_after',
  range: DateRange,
  total: number,
  database: CineDiaryDatabase
): Distribution {
  const rows = database.all<GroupRow>(sql`${withEntries(range)}
    SELECT ${sql.raw(column)} AS "key",
      (SELECT m.label FROM moods m WHERE m.key = ${sql.raw(column)}) AS "label",
      NULL AS "reasonId",
      coalesce((SELECT m.is_custom FROM moods m WHERE m.key = ${sql.raw(column)}), 0) AS "isCustom",
      count(*) AS "watches", ${CHANGE}
    FROM done
    GROUP BY ${sql.raw(column)}`)
  const empty: GroupRow = {
    key: null,
    label: null,
    reasonId: null,
    isCustom: 0,
    watches: 0,
    changeAverage: null,
    changeN: 0
  }
  return toDistribution(
    rows.filter((row) => row.key !== null),
    rows.find((row) => row.key === null) ?? empty,
    total
  )
}

function reasonDistribution(
  range: DateRange,
  total: number,
  database: CineDiaryDatabase
): Distribution {
  const recorded = database.all<GroupRow>(sql`${withEntries(range)}
    SELECT r.key AS "key", r.label AS "label", r.id AS "reasonId", r.is_custom AS "isCustom",
      count(*) AS "watches", ${CHANGE}
    FROM done
    JOIN watch_entry_reasons wer ON wer.watch_entry_id = done.id
    JOIN reasons r ON r.id = wer.reason_id
    GROUP BY r.id`)
  const notRecorded = database.get<GroupRow>(sql`${withEntries(range)}
    SELECT NULL AS "key", NULL AS "label", NULL AS "reasonId", 0 AS "isCustom",
      count(*) AS "watches", ${CHANGE}
    FROM done
    WHERE NOT EXISTS (SELECT 1 FROM watch_entry_reasons wer WHERE wer.watch_entry_id = done.id)`)
  return toDistribution(recorded, notRecorded, total)
}

function countWatches(range: DateRange, database: CineDiaryDatabase): number {
  return database.get<{ n: number }>(sql`${withEntries(range)} SELECT count(*) AS "n" FROM done`).n
}

/** Mood before, mood after and reasons for the finished watches in a range. */
export function feelingDistributions(
  range: DateRange,
  database: CineDiaryDatabase
): { moodBefore: Distribution; moodAfter: Distribution; reasons: Distribution } {
  const total = countWatches(range, database)
  return {
    moodBefore: moodDistribution('mood_before', range, total, database),
    moodAfter: moodDistribution('mood_after', range, total, database),
    reasons: reasonDistribution(range, total, database)
  }
}

function monthsBetween(from: string, to: string): number {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7)) +
    1
  )
}

/** Zero-filled buckets for a range: months, or years when it's longer than 24 months. */
export function timeBuckets(
  from: string | null,
  to: string
): { bucket: TimeBucket; buckets: string[] } {
  if (from === null || from > to) return { bucket: 'month', buckets: [] }
  if (monthsBetween(from, to) > LONG_RANGE_MONTHS) {
    const buckets: string[] = []
    for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
      buckets.push(String(year))
    }
    return { bucket: 'year', buckets }
  }
  const buckets: string[] = []
  const date = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1)
  const last = to.slice(0, 7)
  for (;;) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (key > last) break
    buckets.push(key)
    date.setMonth(date.getMonth() + 1)
  }
  return { bucket: 'month', buckets }
}

function overTime(
  distribution: Distribution,
  counts: Array<{ bucket: string; key: string; n: number }>,
  bucket: TimeBucket,
  buckets: string[]
): OverTime {
  const top = distribution.items.filter((item) => item.key !== null).slice(0, OVER_TIME_TOP)
  const index = new Map(buckets.map((key, position) => [key, position]))
  return {
    bucket,
    buckets,
    series: top.map((item) => {
      const series = buckets.map(() => 0)
      for (const row of counts) {
        const position = index.get(row.bucket)
        if (row.key === item.key && position !== undefined) series[position] = row.n
      }
      return { key: item.key ?? '', label: item.label, counts: series }
    }),
    notRecorded: distribution.items.find((item) => item.key === null)?.watches ?? 0
  }
}

export function getFeelings(
  period: InsightsPeriod,
  database: CineDiaryDatabase = getDatabase(),
  today = getLocalDate()
): FeelingsAnalysis {
  const range = resolvePeriod(period, today, database)
  const to = range.to ?? today
  // An open start ("All time") begins at the first finished watch.
  const from =
    range.from ??
    database.get<{ first: string | null }>(sql`${withEntries(range)}
      SELECT min(completed_at) AS "first" FROM done`).first
  const { bucket, buckets } = timeBuckets(from, to)
  const length = bucket === 'year' ? 4 : 7
  const { moodBefore, moodAfter, reasons } = feelingDistributions(range, database)

  const watches = database.all<{
    key: string
    movies: number
    series: number
  }>(sql`${withEntries(range)}
    SELECT substr(completed_at, 1, ${length}) AS "key",
      sum(type = 'movie') AS "movies", sum(type = 'series') AS "series"
    FROM done GROUP BY 1`)
  const watchesByKey = new Map(watches.map((row) => [row.key, row]))
  const feelingCounts = database.all<{
    bucket: string
    key: string
    n: number
  }>(sql`${withEntries(range)}
    SELECT substr(completed_at, 1, ${length}) AS "bucket", mood_before AS "key", count(*) AS "n"
    FROM done WHERE mood_before IS NOT NULL GROUP BY 1, 2`)
  const reasonCounts = database.all<{
    bucket: string
    key: string
    n: number
  }>(sql`${withEntries(range)}
    SELECT substr(completed_at, 1, ${length}) AS "bucket", r.key AS "key", count(*) AS "n"
    FROM done
    JOIN watch_entry_reasons wer ON wer.watch_entry_id = done.id
    JOIN reasons r ON r.id = wer.reason_id
    GROUP BY 1, 2`)

  return {
    period,
    from: range.from,
    to,
    watchesOverTime: {
      bucket,
      items: buckets.map((key) => watchesByKey.get(key) ?? { key, movies: 0, series: 0 })
    },
    moodBefore,
    moodAfter,
    reasons,
    feelingsOverTime: overTime(moodBefore, feelingCounts, bucket, buckets),
    reasonsOverTime: overTime(reasons, reasonCounts, bucket, buckets)
  }
}

/** One life chapter: its watches, top reasons and feelings, moods, genres, what helped most. */
export function chapterAnalysis(
  chapter: LifePeriod,
  database: CineDiaryDatabase = getDatabase(),
  today = getLocalDate()
): ChapterAnalysis {
  const range = { from: chapter.startDate, to: chapter.endDate ?? today }
  const { moodBefore, reasons } = feelingDistributions(range, database)
  const recorded = (distribution: Distribution): DistributionItem[] =>
    distribution.items.filter((item) => item.key !== null).slice(0, CHAPTER_TOP)
  return {
    chapter,
    from: range.from,
    to: range.to,
    watches: moodBefore.total,
    topReasons: recorded(reasons),
    topFeelings: recorded(moodBefore),
    mood: getMoodOverview(range, database),
    topGenres: getGenres(range, database).slice(0, CHAPTER_TOP),
    helpedMost: rankTitles(range, null, CHAPTER_TOP, database)
  }
}

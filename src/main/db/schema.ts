import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

/** SQL: a column holds nothing or a whole number from 1 to 10 (scores and ratings). */
const oneToTen = (column: string): ReturnType<typeof sql> =>
  sql.raw(`${column} IS NULL OR (typeof(${column}) = 'integer' AND ${column} BETWEEN 1 AND 10)`)

export const titles = sqliteTable(
  'titles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['movie', 'series'] }).notNull(),
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    year: integer('year'),
    overview: text('overview'),
    country: text('country'),
    language: text('language'),
    runtimeMinutes: integer('runtime_minutes'),
    totalSeasons: integer('total_seasons'),
    totalEpisodes: integer('total_episodes'),
    status: text('status', {
      enum: ['planned', 'watching', 'completed', 'dropped', 'rewatching']
    })
      .notNull()
      .default('planned'),
    rating: integer('rating'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    posterFile: text('poster_file'),
    /** Local TMDB backdrop in userData/backdrops, nullable. */
    backdropFile: text('backdrop_file'),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),
    tmdbSyncedAt: text('tmdb_synced_at'),
    /** JSON of the TMDB values from the last sync; a field that differs from it was edited by me. */
    tmdbSnapshot: text('tmdb_snapshot'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('titles_tmdb_type_unique').on(table.tmdbId, table.type),
    index('titles_title_index').on(table.title),
    index('titles_status_index').on(table.status),
    check('titles_rating_check', oneToTen('rating'))
  ]
)

export const genres = sqliteTable('genres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const titleGenres = sqliteTable(
  'title_genres',
  {
    titleId: integer('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    genreId: integer('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.titleId, table.genreId] }),
    // "Titles in this genre" lookups (genre filter, genre stats) start from the genre.
    index('title_genres_genre_id_index').on(table.genreId)
  ]
)

export const watchEntries = sqliteTable(
  'watch_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    titleId: integer('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    isRewatch: integer('is_rewatch', { mode: 'boolean' }).notNull().default(false),
    episodesWatched: integer('episodes_watched').notNull().default(0),
    moodBefore: text('mood_before'),
    moodBeforeScore: integer('mood_before_score'),
    reasonNote: text('reason_note'),
    moodAfter: text('mood_after'),
    moodAfterScore: integer('mood_after_score'),
    thoughts: text('thoughts'),
    lessons: text('lessons'),
    favoriteCharacter: text('favorite_character'),
    favoriteScene: text('favorite_scene'),
    favoriteQuote: text('favorite_quote'),
    wouldRewatch: integer('would_rewatch', { mode: 'boolean' }),
    wouldRecommend: integer('would_recommend', { mode: 'boolean' }),
    notes: text('notes'),
    /** Marked as a highlight on the timeline. */
    isHighlight: integer('is_highlight', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('watch_entries_title_id_index').on(table.titleId),
    // Insights periods, chapters and the timeline select finished watches by date.
    index('watch_entries_completed_at_index').on(table.completedAt),
    check('watch_entries_mood_before_score_check', oneToTen('mood_before_score')),
    check('watch_entries_mood_after_score_check', oneToTen('mood_after_score'))
  ]
)

export const reasons = sqliteTable('reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  /** Hidden from pickers; still shown on old entries, in Insights, filters and exports. */
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  /** Order in pickers (Settings → Moods & reasons). */
  sortOrder: integer('sort_order').notNull().default(0)
})

/**
 * Moods you can pick before and after a watch. watch_entries.mood_before / mood_after store the
 * key, which never changes (renaming only changes the label). Seeded in migration 0005.
 */
export const moods = sqliteTable('moods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  emoji: text('emoji').notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0)
})

export const watchEntryReasons = sqliteTable(
  'watch_entry_reasons',
  {
    watchEntryId: integer('watch_entry_id')
      .notNull()
      .references(() => watchEntries.id, { onDelete: 'cascade' }),
    reasonId: integer('reason_id')
      .notNull()
      .references(() => reasons.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.watchEntryId, table.reasonId] }),
    // Reason filters and per-reason stats start from the reason.
    index('watch_entry_reasons_reason_id_index').on(table.reasonId)
  ]
)

/** Top-billed cast from TMDB (no photos). */
export const titleCast = sqliteTable(
  'title_cast',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    titleId: integer('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    character: text('character'),
    order: integer('order').notNull()
  },
  (table) => [index('title_cast_title_id_index').on(table.titleId)]
)

/** Directors (movies) and creators (series) from TMDB. */
export const titleCrew = sqliteTable(
  'title_crew',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    titleId: integer('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role', { enum: ['director', 'creator'] }).notNull(),
    order: integer('order').notNull()
  },
  (table) => [index('title_crew_title_id_index').on(table.titleId)]
)

/** Life chapters on the timeline, e.g. "Final year at university". They may overlap. */
export const lifePeriods = sqliteTable('life_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  /** Empty = ongoing. */
  endDate: text('end_date'),
  /** A key from CHAPTER_COLORS (src/shared/timeline.ts), never a raw color. */
  color: text('color').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const titlesRelations = relations(titles, ({ many }) => ({
  titleGenres: many(titleGenres),
  watchEntries: many(watchEntries),
  cast: many(titleCast),
  crew: many(titleCrew)
}))

export const titleCastRelations = relations(titleCast, ({ one }) => ({
  title: one(titles, { fields: [titleCast.titleId], references: [titles.id] })
}))

export const titleCrewRelations = relations(titleCrew, ({ one }) => ({
  title: one(titles, { fields: [titleCrew.titleId], references: [titles.id] })
}))

export const genresRelations = relations(genres, ({ many }) => ({
  titleGenres: many(titleGenres)
}))

export const titleGenresRelations = relations(titleGenres, ({ one }) => ({
  title: one(titles, { fields: [titleGenres.titleId], references: [titles.id] }),
  genre: one(genres, { fields: [titleGenres.genreId], references: [genres.id] })
}))

export const watchEntriesRelations = relations(watchEntries, ({ many, one }) => ({
  title: one(titles, { fields: [watchEntries.titleId], references: [titles.id] }),
  reasons: many(watchEntryReasons)
}))

export const reasonsRelations = relations(reasons, ({ many }) => ({
  watchEntries: many(watchEntryReasons)
}))

export const watchEntryReasonsRelations = relations(watchEntryReasons, ({ one }) => ({
  watchEntry: one(watchEntries, {
    fields: [watchEntryReasons.watchEntryId],
    references: [watchEntries.id]
  }),
  reason: one(reasons, {
    fields: [watchEntryReasons.reasonId],
    references: [reasons.id]
  })
}))

import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
    index('titles_status_index').on(table.status)
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
  (table) => [primaryKey({ columns: [table.titleId, table.genreId] })]
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
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('watch_entries_title_id_index').on(table.titleId)]
)

export const reasons = sqliteTable('reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false)
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
  (table) => [primaryKey({ columns: [table.watchEntryId, table.reasonId] })]
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

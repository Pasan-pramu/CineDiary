-- Mood scores and the personal rating are whole numbers from 1 to 10 (or empty).
-- SQLite can only add a CHECK by rebuilding the table. migrateDatabase() runs migrations with
-- foreign keys OFF, so dropping the old tables never cascades into watches, reasons, genres or
-- cast. If an old row breaks a rule, the copy fails and the whole migration rolls back:
-- nothing is changed silently (npm run check:scores lists such rows).
CREATE TABLE `__new_titles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`overview` text,
	`country` text,
	`language` text,
	`runtime_minutes` integer,
	`total_seasons` integer,
	`total_episodes` integer,
	`status` text DEFAULT 'planned' NOT NULL,
	`rating` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`poster_file` text,
	`backdrop_file` text,
	`tmdb_id` integer,
	`imdb_id` text,
	`tmdb_synced_at` text,
	`tmdb_snapshot` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "titles_rating_check" CHECK(rating IS NULL OR (typeof(rating) = 'integer' AND rating BETWEEN 1 AND 10))
);
--> statement-breakpoint
INSERT INTO `__new_titles`("id", "type", "title", "original_title", "year", "overview", "country", "language", "runtime_minutes", "total_seasons", "total_episodes", "status", "rating", "is_favorite", "poster_file", "backdrop_file", "tmdb_id", "imdb_id", "tmdb_synced_at", "tmdb_snapshot", "created_at", "updated_at") SELECT "id", "type", "title", "original_title", "year", "overview", "country", "language", "runtime_minutes", "total_seasons", "total_episodes", "status", "rating", "is_favorite", "poster_file", "backdrop_file", "tmdb_id", "imdb_id", "tmdb_synced_at", "tmdb_snapshot", "created_at", "updated_at" FROM `titles`;--> statement-breakpoint
-- Keep the id counter, so ids of deleted rows are never reused.
DELETE FROM `sqlite_sequence` WHERE `name` = '__new_titles';--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT '__new_titles', `seq` FROM `sqlite_sequence` WHERE `name` = 'titles';--> statement-breakpoint
DROP TABLE `titles`;--> statement-breakpoint
ALTER TABLE `__new_titles` RENAME TO `titles`;--> statement-breakpoint
CREATE UNIQUE INDEX `titles_tmdb_type_unique` ON `titles` (`tmdb_id`,`type`);--> statement-breakpoint
CREATE INDEX `titles_title_index` ON `titles` (`title`);--> statement-breakpoint
CREATE INDEX `titles_status_index` ON `titles` (`status`);--> statement-breakpoint
CREATE TABLE `__new_watch_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`is_rewatch` integer DEFAULT false NOT NULL,
	`episodes_watched` integer DEFAULT 0 NOT NULL,
	`mood_before` text,
	`mood_before_score` integer,
	`reason_note` text,
	`mood_after` text,
	`mood_after_score` integer,
	`thoughts` text,
	`lessons` text,
	`favorite_character` text,
	`favorite_scene` text,
	`favorite_quote` text,
	`would_rewatch` integer,
	`would_recommend` integer,
	`notes` text,
	`is_highlight` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "watch_entries_mood_before_score_check" CHECK(mood_before_score IS NULL OR (typeof(mood_before_score) = 'integer' AND mood_before_score BETWEEN 1 AND 10)),
	CONSTRAINT "watch_entries_mood_after_score_check" CHECK(mood_after_score IS NULL OR (typeof(mood_after_score) = 'integer' AND mood_after_score BETWEEN 1 AND 10))
);
--> statement-breakpoint
INSERT INTO `__new_watch_entries`("id", "title_id", "started_at", "completed_at", "is_rewatch", "episodes_watched", "mood_before", "mood_before_score", "reason_note", "mood_after", "mood_after_score", "thoughts", "lessons", "favorite_character", "favorite_scene", "favorite_quote", "would_rewatch", "would_recommend", "notes", "is_highlight", "created_at", "updated_at") SELECT "id", "title_id", "started_at", "completed_at", "is_rewatch", "episodes_watched", "mood_before", "mood_before_score", "reason_note", "mood_after", "mood_after_score", "thoughts", "lessons", "favorite_character", "favorite_scene", "favorite_quote", "would_rewatch", "would_recommend", "notes", "is_highlight", "created_at", "updated_at" FROM `watch_entries`;--> statement-breakpoint
-- Keep the id counter, so ids of deleted rows are never reused.
DELETE FROM `sqlite_sequence` WHERE `name` = '__new_watch_entries';--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT '__new_watch_entries', `seq` FROM `sqlite_sequence` WHERE `name` = 'watch_entries';--> statement-breakpoint
DROP TABLE `watch_entries`;--> statement-breakpoint
ALTER TABLE `__new_watch_entries` RENAME TO `watch_entries`;--> statement-breakpoint
CREATE INDEX `watch_entries_title_id_index` ON `watch_entries` (`title_id`);--> statement-breakpoint
CREATE INDEX `watch_entries_completed_at_index` ON `watch_entries` (`completed_at`);
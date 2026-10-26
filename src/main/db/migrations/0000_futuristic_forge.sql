CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `reasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reasons_key_unique` ON `reasons` (`key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `title_genres` (
	`title_id` integer NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`title_id`, `genre_id`),
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `titles` (
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
	`tmdb_id` integer,
	`imdb_id` text,
	`tmdb_synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `titles_tmdb_type_unique` ON `titles` (`tmdb_id`,`type`);--> statement-breakpoint
CREATE INDEX `titles_title_index` ON `titles` (`title`);--> statement-breakpoint
CREATE INDEX `titles_status_index` ON `titles` (`status`);--> statement-breakpoint
CREATE TABLE `watch_entries` (
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
	`would_rewatch` integer,
	`would_recommend` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watch_entries_title_id_index` ON `watch_entries` (`title_id`);--> statement-breakpoint
CREATE TABLE `watch_entry_reasons` (
	`watch_entry_id` integer NOT NULL,
	`reason_id` integer NOT NULL,
	PRIMARY KEY(`watch_entry_id`, `reason_id`),
	FOREIGN KEY (`watch_entry_id`) REFERENCES `watch_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reason_id`) REFERENCES `reasons`(`id`) ON UPDATE no action ON DELETE cascade
);

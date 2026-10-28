CREATE INDEX `title_genres_genre_id_index` ON `title_genres` (`genre_id`);--> statement-breakpoint
CREATE INDEX `watch_entries_completed_at_index` ON `watch_entries` (`completed_at`);--> statement-breakpoint
CREATE INDEX `watch_entry_reasons_reason_id_index` ON `watch_entry_reasons` (`reason_id`);
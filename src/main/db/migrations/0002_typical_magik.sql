CREATE TABLE `title_cast` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_id` integer NOT NULL,
	`name` text NOT NULL,
	`character` text,
	`order` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `title_cast_title_id_index` ON `title_cast` (`title_id`);--> statement-breakpoint
CREATE TABLE `title_crew` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `title_crew_title_id_index` ON `title_crew` (`title_id`);--> statement-breakpoint
ALTER TABLE `titles` ADD `backdrop_file` text;--> statement-breakpoint
ALTER TABLE `titles` ADD `tmdb_snapshot` text;
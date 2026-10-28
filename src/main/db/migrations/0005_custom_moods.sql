CREATE TABLE `moods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`emoji` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moods_key_unique` ON `moods` (`key`);--> statement-breakpoint
ALTER TABLE `reasons` ADD `is_hidden` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reasons` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- The built-in moods (formerly the MOODS constant). Entries store these keys, so they keep working.
INSERT INTO `moods` (`key`, `label`, `emoji`, `is_custom`, `is_hidden`, `sort_order`) VALUES
	('very_happy', 'Very happy', '😄', 0, 0, 1),
	('happy', 'Happy', '🙂', 0, 0, 2),
	('neutral', 'Neutral', '😐', 0, 0, 3),
	('sad', 'Sad', '😔', 0, 0, 4),
	('stressed', 'Stressed', '😩', 0, 0, 5),
	('demotivated', 'Demotivated', '😞', 0, 0, 6),
	('bored', 'Bored', '😴', 0, 0, 7),
	('lonely', 'Lonely', '❤️', 0, 0, 8),
	('overwhelmed', 'Overwhelmed', '🤯', 0, 0, 9),
	('calm', 'Calm', '😌', 0, 0, 10);--> statement-breakpoint
-- Safety net: any other key already used by an entry becomes a custom mood, so nothing is lost.
INSERT OR IGNORE INTO `moods` (`key`, `label`, `emoji`, `is_custom`, `is_hidden`, `sort_order`)
	SELECT `key`, `key`, '•', 1, 0, 100 FROM (
		SELECT `mood_before` AS `key` FROM `watch_entries` WHERE `mood_before` IS NOT NULL
		UNION SELECT `mood_after` FROM `watch_entries` WHERE `mood_after` IS NOT NULL
	);--> statement-breakpoint
-- Reasons keep today's alphabetical order.
UPDATE `reasons` SET `sort_order` = 1 + (
	SELECT count(*) FROM `reasons` AS `other`
	WHERE lower(`other`.`label`) < lower(`reasons`.`label`)
		OR (lower(`other`.`label`) = lower(`reasons`.`label`) AND `other`.`id` < `reasons`.`id`)
);

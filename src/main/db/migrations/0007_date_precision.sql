-- How well a finished watch's date is known: 'day' (exact), 'month', 'year' or 'unknown'.
-- A plain ADD COLUMN (no table rebuild): existing watches are not copied or touched, they only
-- read as 'day'. Partial dates are stored as the first day they could be (see watchDate.ts).
ALTER TABLE `watch_entries` ADD `date_precision` text DEFAULT 'day' NOT NULL CONSTRAINT "watch_entries_date_precision_check" CHECK(date_precision IN ('day', 'month', 'year', 'unknown'));

CREATE TABLE `media` (
	`url` text PRIMARY KEY,
	`type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sizes` text NOT NULL,
	`created_at` text NOT NULL
);

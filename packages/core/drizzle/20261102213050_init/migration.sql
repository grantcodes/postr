CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`run_at` integer NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `post_refs` (
	`post_id` text NOT NULL,
	`rel` text NOT NULL,
	`url` text NOT NULL,
	CONSTRAINT `post_refs_pk` PRIMARY KEY(`post_id`, `rel`, `url`),
	CONSTRAINT `fk_post_refs_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL UNIQUE,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`post_type` text NOT NULL,
	`status` text NOT NULL,
	`visibility` text NOT NULL,
	`published` text NOT NULL,
	`published_at` integer NOT NULL,
	`updated` text NOT NULL,
	`deleted_at` text,
	`properties` text NOT NULL,
	`children` text
);
--> statement-breakpoint
CREATE TABLE `refs` (
	`url` text PRIMARY KEY,
	`entry` text,
	`fetched_at` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `jobs_run_at_idx` ON `jobs` (`run_at`);--> statement-breakpoint
CREATE INDEX `post_refs_url_idx` ON `post_refs` (`url`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_post_type_idx` ON `posts` (`post_type`);
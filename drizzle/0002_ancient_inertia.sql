CREATE TABLE `coursition_source_cleanup` (
	`attempts` integer NOT NULL,
	`cleanup_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`draft_id` text NOT NULL,
	`last_error` text,
	`next_attempt_at` integer NOT NULL,
	`owner_id` text NOT NULL,
	`reference` text NOT NULL,
	`source_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coursition_source_cleanup_due_idx` ON `coursition_source_cleanup` (`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `coursition_source_cleanup_owner_idx` ON `coursition_source_cleanup` (`owner_id`,`draft_id`);
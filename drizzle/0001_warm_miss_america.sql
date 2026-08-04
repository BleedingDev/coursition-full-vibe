CREATE TABLE `coursition_draft` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_operation_id` text,
	`owner_id` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coursition_draft_owner_idx` ON `coursition_draft` (`owner_id`);--> statement-breakpoint
CREATE INDEX `coursition_draft_owner_updated_idx` ON `coursition_draft` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `coursition_operation` (
	`action` text NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`draft_id` text,
	`expected_revision` integer,
	`failure_code` text,
	`lease_expires_at` integer NOT NULL,
	`lease_token` text NOT NULL,
	`operation_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`result_revision` integer,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `operation_id`)
);
--> statement-breakpoint
CREATE INDEX `coursition_operation_draft_idx` ON `coursition_operation` (`owner_id`,`draft_id`);--> statement-breakpoint
CREATE INDEX `coursition_operation_lease_idx` ON `coursition_operation` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE TABLE `coursition_owner_state` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `discord_interaction_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`interaction_type` integer NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_interaction_receipts_interaction_id_unique` ON `discord_interaction_receipts` (`interaction_id`);--> statement-breakpoint
CREATE TABLE `discord_processed_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`message_id` text NOT NULL,
	`parse_status` text DEFAULT 'processed' NOT NULL,
	`raw_content` text,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_processed_messages_message_id_unique` ON `discord_processed_messages` (`message_id`);--> statement-breakpoint
CREATE TABLE `discord_thread_states` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sunday_date` text NOT NULL,
	`conti_id` text,
	`preacher` text,
	`leader` text,
	`worship_leader` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conti_id`) REFERENCES `contis`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_thread_states_thread_id_unique` ON `discord_thread_states` (`thread_id`);
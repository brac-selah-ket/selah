CREATE TABLE `conti_pdf_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`conti_id` text NOT NULL,
	`pdf_url` text,
	`layout_state` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conti_id`) REFERENCES `contis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conti_pdf_export_unique` ON `conti_pdf_exports` (`conti_id`);--> statement-breakpoint
CREATE TABLE `conti_songs` (
	`id` text PRIMARY KEY NOT NULL,
	`conti_id` text NOT NULL,
	`song_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`keys` text,
	`tempos` text,
	`section_order` text,
	`lyrics` text,
	`section_lyrics_map` text,
	`notes` text,
	`sheet_music_file_ids` text,
	`preset_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conti_id`) REFERENCES `contis`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`preset_id`) REFERENCES `song_presets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conti_song_unique` ON `conti_songs` (`conti_id`,`song_id`);--> statement-breakpoint
CREATE TABLE `contis` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`date` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preset_sheet_music` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`sheet_music_file_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `song_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sheet_music_file_id`) REFERENCES `sheet_music_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preset_sheet_music_unique` ON `preset_sheet_music` (`preset_id`,`sheet_music_file_id`);--> statement-breakpoint
CREATE TABLE `sheet_music_files` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`file_url` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `song_page_images` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`conti_id` text NOT NULL,
	`image_url` text NOT NULL,
	`page_index` integer NOT NULL,
	`sheet_music_file_id` text,
	`pdf_page_index` integer,
	`preset_snapshot` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conti_id`) REFERENCES `contis`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sheet_music_file_id`) REFERENCES `sheet_music_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `song_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`name` text NOT NULL,
	`keys` text,
	`tempos` text,
	`section_order` text,
	`lyrics` text,
	`section_lyrics_map` text,
	`notes` text,
	`youtube_reference` text,
	`youtube_title` text,
	`pdf_metadata` text,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

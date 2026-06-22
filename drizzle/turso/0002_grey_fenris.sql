CREATE TABLE `song_preset_songs` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`song_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`part_label` text,
	FOREIGN KEY (`preset_id`) REFERENCES `song_presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO song_preset_songs (id, preset_id, song_id, sort_order, part_label)
SELECT id || ':song:0', id, song_id, 0, NULL
FROM song_presets;
--> statement-breakpoint
CREATE UNIQUE INDEX `song_preset_songs_unique` ON `song_preset_songs` (`preset_id`,`song_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `song_preset_songs_order_unique` ON `song_preset_songs` (`preset_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `song_preset_songs_song_idx` ON `song_preset_songs` (`song_id`);--> statement-breakpoint
ALTER TABLE `conti_songs` ADD `mashup_group_id` text;--> statement-breakpoint
ALTER TABLE `conti_songs` ADD `mashup_part_order` integer;--> statement-breakpoint
ALTER TABLE `conti_songs` ADD `pre_mashup_preset_id` text REFERENCES song_presets(id);--> statement-breakpoint
ALTER TABLE `song_presets` ADD `preset_type` text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE `song_presets` ADD `display_title` text;

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
ALTER TABLE `conti_songs` ADD `pre_mashup_preset_id` text REFERENCES song_presets(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `song_presets` ADD `preset_type` text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE `song_presets` ADD `display_title` text;--> statement-breakpoint
ALTER TABLE `song_presets` ADD `mashup_pair_key` text;--> statement-breakpoint
UPDATE `song_presets`
SET `mashup_pair_key` = (
	SELECT first_member.`song_id` || '→' || second_member.`song_id`
	FROM `song_preset_songs` AS first_member
	JOIN `song_preset_songs` AS second_member
		ON second_member.`preset_id` = first_member.`preset_id`
	WHERE first_member.`preset_id` = `song_presets`.`id`
		AND first_member.`sort_order` = 0
		AND second_member.`sort_order` = 1
)
WHERE `preset_type` = 'mashup'
	AND (
		SELECT COUNT(*)
		FROM `song_preset_songs`
		WHERE `song_preset_songs`.`preset_id` = `song_presets`.`id`
	) = 2;
--> statement-breakpoint
CREATE UNIQUE INDEX `song_presets_mashup_pair_key_unique` ON `song_presets` (`mashup_pair_key`);--> statement-breakpoint
ALTER TABLE `songs` ADD `lyrics` text;--> statement-breakpoint
UPDATE `songs`
SET `lyrics` = COALESCE(
  (
    SELECT `song_presets`.`lyrics`
    FROM `song_presets`
    JOIN `song_preset_songs`
      ON `song_preset_songs`.`preset_id` = `song_presets`.`id`
    WHERE `song_preset_songs`.`song_id` = `songs`.`id`
      AND `song_presets`.`preset_type` = 'single'
      AND `song_presets`.`lyrics` IS NOT NULL
      AND `song_presets`.`lyrics` != ''
      AND `song_presets`.`lyrics` != '[]'
    ORDER BY `song_presets`.`is_default` DESC, `song_presets`.`sort_order` ASC, `song_presets`.`id` ASC
    LIMIT 1
  ),
  '[]'
);--> statement-breakpoint
UPDATE `song_presets`
SET `lyrics` = '[]'
WHERE `preset_type` = 'single';

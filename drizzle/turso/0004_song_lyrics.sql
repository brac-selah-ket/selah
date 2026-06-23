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

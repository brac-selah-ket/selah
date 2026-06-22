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
	) = 2;--> statement-breakpoint
CREATE UNIQUE INDEX `song_presets_mashup_pair_key_unique` ON `song_presets` (`mashup_pair_key`);

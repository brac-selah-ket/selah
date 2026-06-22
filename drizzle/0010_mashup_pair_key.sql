ALTER TABLE "song_presets" ADD COLUMN "mashup_pair_key" text;--> statement-breakpoint
UPDATE "song_presets" AS preset
SET "mashup_pair_key" = pair.first_song_id || '→' || pair.second_song_id
FROM (
	SELECT
		"preset_id",
		MAX(CASE WHEN "sort_order" = 0 THEN "song_id" END) AS first_song_id,
		MAX(CASE WHEN "sort_order" = 1 THEN "song_id" END) AS second_song_id,
		COUNT(*) AS member_count
	FROM "song_preset_songs"
	GROUP BY "preset_id"
) AS pair
WHERE preset."id" = pair."preset_id"
	AND preset."preset_type" = 'mashup'
	AND pair.member_count = 2
	AND pair.first_song_id IS NOT NULL
	AND pair.second_song_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "song_presets_mashup_pair_key_unique" ON "song_presets" USING btree ("mashup_pair_key");

CREATE TABLE "song_preset_songs" (
	"id" text PRIMARY KEY NOT NULL,
	"preset_id" text NOT NULL,
	"song_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"part_label" text
);
--> statement-breakpoint
INSERT INTO song_preset_songs (id, preset_id, song_id, sort_order, part_label)
SELECT id || ':song:0', id, song_id, 0, NULL
FROM song_presets;
--> statement-breakpoint
ALTER TABLE "conti_songs" ADD COLUMN "mashup_group_id" text;--> statement-breakpoint
ALTER TABLE "conti_songs" ADD COLUMN "mashup_part_order" integer;--> statement-breakpoint
ALTER TABLE "conti_songs" ADD COLUMN "pre_mashup_preset_id" text;--> statement-breakpoint
ALTER TABLE "song_presets" ADD COLUMN "preset_type" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "song_presets" ADD COLUMN "display_title" text;--> statement-breakpoint
ALTER TABLE "song_preset_songs" ADD CONSTRAINT "song_preset_songs_preset_id_song_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."song_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_preset_songs" ADD CONSTRAINT "song_preset_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "song_preset_songs_unique" ON "song_preset_songs" USING btree ("preset_id","song_id");--> statement-breakpoint
CREATE UNIQUE INDEX "song_preset_songs_order_unique" ON "song_preset_songs" USING btree ("preset_id","sort_order");--> statement-breakpoint
CREATE INDEX "song_preset_songs_song_idx" ON "song_preset_songs" USING btree ("song_id");--> statement-breakpoint
ALTER TABLE "conti_songs" ADD CONSTRAINT "conti_songs_pre_mashup_preset_id_song_presets_id_fk" FOREIGN KEY ("pre_mashup_preset_id") REFERENCES "public"."song_presets"("id") ON DELETE set null ON UPDATE no action;

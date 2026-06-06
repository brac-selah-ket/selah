CREATE TABLE "worship_prep_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"sunday_date" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"thread_id" text,
	"message_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "worship_prep_notifications_week_type_unique" ON "worship_prep_notifications" USING btree ("sunday_date","type");--> statement-breakpoint
CREATE INDEX "contis_date_idx" ON "contis" USING btree ("date");
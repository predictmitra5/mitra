-- Discovery measurement for the public feed, decided 2026-09-19.
-- Deliberately carries no viewer identity: only which goal was shown or opened,
-- and when. Counts therefore cannot be deduplicated per person. Adding any
-- identifying column needs the discovery privacy decision (D08, D09) first.

CREATE TYPE "public"."feed_event_kind" AS ENUM('exposure', 'click');--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"kind" "feed_event_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_events_market_time_idx" ON "feed_events" USING btree ("market_id","created_at");--> statement-breakpoint
-- Same deny-by-default posture as every other table (see 0001): the publishable
-- key exposed in the browser reads nothing through the Supabase REST API.
ALTER TABLE "feed_events" ENABLE ROW LEVEL SECURITY;

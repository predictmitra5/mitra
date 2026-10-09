CREATE TYPE "public"."market_category" AS ENUM('nightlife', 'food', 'events', 'entertainment', 'campus');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_end_after_start" CHECK ("events"."ends_at" > "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "market_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposer_user_id" uuid NOT NULL,
	"campus" text NOT NULL,
	"question" text NOT NULL,
	"category" "market_category" NOT NULL,
	"venue_name" text NOT NULL,
	"venue_id" uuid,
	"window_start_at" timestamp with time zone NOT NULL,
	"window_end_at" timestamp with time zone,
	"resolution_note" text NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"market_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolution_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"method" text NOT NULL,
	"url" text,
	"operational" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campus" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "market_category" NOT NULL,
	"area" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "subject_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "campus" text;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "category" "market_category";--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "resolution_source_id" uuid;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "window_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "window_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "yes_condition" text;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "no_condition" text;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "is_sample" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_proposer_user_id_profiles_id_fk" FOREIGN KEY ("proposer_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_venue_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "market_proposals_status_idx" ON "market_proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "market_proposals_proposer_idx" ON "market_proposals" USING btree ("proposer_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_slug_key" ON "venues" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "venues_campus_idx" ON "venues" USING btree ("campus");--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_resolution_source_id_resolution_sources_id_fk" FOREIGN KEY ("resolution_source_id") REFERENCES "public"."resolution_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "markets_venue_idx" ON "markets" USING btree ("venue_id");--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_goal_or_event" CHECK ("markets"."subject_user_id" is not null or ("markets"."venue_id" is not null and "markets"."campus" is not null
        and "markets"."category" is not null and "markets"."resolution_source_id" is not null
        and "markets"."window_start_at" is not null and "markets"."window_end_at" is not null and "markets"."window_end_at" > "markets"."window_start_at"
        and "markets"."time_zone" is not null and "markets"."yes_condition" is not null and "markets"."no_condition" is not null
        and "markets"."evidence_deadline_at" >= "markets"."window_end_at"));--> statement-breakpoint
-- Deny by default, as in 0001: only server code reaches these tables.
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resolution_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "market_proposals" ENABLE ROW LEVEL SECURITY;

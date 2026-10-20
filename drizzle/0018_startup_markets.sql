CREATE TYPE "public"."comment_target" AS ENUM('market', 'video', 'startup');--> statement-breakpoint
CREATE TYPE "public"."industry" AS ENUM('ai', 'robotics', 'edtech', 'healthcare', 'devtools', 'gaming', 'climate', 'consumer', 'fintech', 'hardware', 'other');--> statement-breakpoint
CREATE TYPE "public"."milestone_kind" AS ENUM('adoption', 'accelerator', 'competition', 'award', 'financial', 'launch', 'ranking', 'performance', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('video', 'comment', 'startup', 'founder', 'market');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('unverified', 'founder_reported', 'independently_verified', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."video_event_kind" AS ENUM('impression', 'watch', 'complete', 'rewatch', 'skip', 'like', 'unlike', 'save', 'unsave', 'share', 'comment', 'follow_founder', 'follow_startup', 'not_interested', 'report', 'open_market');--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'approve_founder';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'reject_founder';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'approve_startup';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'reject_startup';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'approve_video';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'reject_video';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'edit_market';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'pause';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'resume';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'review_claim';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'resolve_report';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'remove_comment';--> statement-breakpoint
ALTER TYPE "public"."upload_intent_kind" ADD VALUE 'media_image';--> statement-breakpoint
ALTER TYPE "public"."upload_intent_kind" ADD VALUE 'media_video';--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" "comment_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_body_length" CHECK (char_length("comments"."body") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "founder_follows" (
	"founder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "founder_follows_founder_id_user_id_pk" PRIMARY KEY("founder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "founders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"background" text,
	"location" text,
	"portrait_url" text,
	"hue" integer DEFAULT 205 NOT NULL,
	"accomplishments" text[] DEFAULT '{}'::text[] NOT NULL,
	"website_url" text,
	"user_id" uuid,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reporter_user_id" uuid,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "startup_follows" (
	"startup_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "startup_follows_startup_id_user_id_pk" PRIMARY KEY("startup_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "startup_founders" (
	"startup_id" uuid NOT NULL,
	"founder_id" uuid NOT NULL,
	"role" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "startup_founders_startup_id_founder_id_pk" PRIMARY KEY("startup_id","founder_id")
);
--> statement-breakpoint
CREATE TABLE "startup_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startup_id" uuid,
	"founder_id" uuid,
	"kind" text DEFAULT 'update' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"happened_at" timestamp with time zone NOT NULL,
	"verification" "verification_level" DEFAULT 'founder_reported' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "startup_updates_has_owner" CHECK ("startup_updates"."startup_id" is not null or "startup_updates"."founder_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "startups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"headline" text NOT NULL,
	"description" text NOT NULL,
	"industry" "industry" NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"founded_on" timestamp with time zone,
	"stage" text NOT NULL,
	"headquarters" text,
	"website_url" text,
	"logo_url" text,
	"glyph" text DEFAULT 'sparkles' NOT NULL,
	"hue" integer DEFAULT 210 NOT NULL,
	"product_details" text NOT NULL,
	"product_features" text[] DEFAULT '{}'::text[] NOT NULL,
	"product_image_url" text,
	"thumbnail_url" text,
	"screenshot_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"verification" "verification_level" DEFAULT 'unverified' NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "verification_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startup_id" uuid NOT NULL,
	"market_id" uuid,
	"statement" text NOT NULL,
	"level" "verification_level" DEFAULT 'unverified' NOT NULL,
	"source_name" text,
	"source_url" text,
	"review_note" text,
	"submitted_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"viewer_key" text NOT NULL,
	"user_id" uuid,
	"kind" "video_event_kind" NOT NULL,
	"watch_ms" integer DEFAULT 0 NOT NULL,
	"progress_bp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_likes" (
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_likes_video_id_user_id_pk" PRIMARY KEY("video_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "video_saves" (
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_saves_video_id_user_id_pk" PRIMARY KEY("video_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startup_id" uuid NOT NULL,
	"founder_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" text DEFAULT 'pitch' NOT NULL,
	"video_url" text,
	"thumbnail_url" text,
	"duration_seconds" integer NOT NULL,
	"captions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "videos_duration_positive" CHECK ("videos"."duration_seconds" > 0 and "videos"."duration_seconds" <= 3600)
);
--> statement-breakpoint
CREATE TABLE "viewer_interests" (
	"viewer_key" text NOT NULL,
	"industry" "industry" NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viewer_interests_viewer_key_industry_pk" PRIMARY KEY("viewer_key","industry")
);
--> statement-breakpoint
ALTER TABLE "markets" DROP CONSTRAINT "markets_goal_or_event";--> statement-breakpoint
ALTER TABLE "market_proposals" ALTER COLUMN "campus" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "market_proposals" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "market_proposals" ALTER COLUMN "venue_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "market_proposals" ALTER COLUMN "window_start_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD COLUMN "startup_id" uuid;--> statement-breakpoint
ALTER TABLE "market_proposals" ADD COLUMN "suggested_close_at" timestamp with time zone;--> statement-breakpoint
-- Short titles (2026-10-09) were applied to the live database as 0014_short_titles before this line's 0014 existed.
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "short_question" text;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "startup_id" uuid;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "milestone_kind" "milestone_kind";--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "paused_reason" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_removed_by_profiles_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founder_follows" ADD CONSTRAINT "founder_follows_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founder_follows" ADD CONSTRAINT "founder_follows_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founders" ADD CONSTRAINT "founders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founders" ADD CONSTRAINT "founders_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_profiles_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_follows" ADD CONSTRAINT "startup_follows_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_follows" ADD CONSTRAINT "startup_follows_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_founders" ADD CONSTRAINT "startup_founders_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_founders" ADD CONSTRAINT "startup_founders_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_updates" ADD CONSTRAINT "startup_updates_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_updates" ADD CONSTRAINT "startup_updates_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_updates" ADD CONSTRAINT "startup_updates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startups" ADD CONSTRAINT "startups_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startups" ADD CONSTRAINT "startups_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_claims" ADD CONSTRAINT "verification_claims_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_claims" ADD CONSTRAINT "verification_claims_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_claims" ADD CONSTRAINT "verification_claims_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_events" ADD CONSTRAINT "video_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_events" ADD CONSTRAINT "video_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_saves" ADD CONSTRAINT "video_saves_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_saves" ADD CONSTRAINT "video_saves_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_founder_id_founders_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."founders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target","target_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "founder_follows_user_idx" ON "founder_follows" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "founders_handle_key" ON "founders" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "founders_user_idx" ON "founders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "founders_status_idx" ON "founders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "startup_follows_user_idx" ON "startup_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "startup_founders_founder_idx" ON "startup_founders" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "startup_updates_startup_idx" ON "startup_updates" USING btree ("startup_id","happened_at");--> statement-breakpoint
CREATE INDEX "startup_updates_founder_idx" ON "startup_updates" USING btree ("founder_id","happened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "startups_slug_key" ON "startups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "startups_industry_idx" ON "startups" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "startups_status_idx" ON "startups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "startups_created_by_idx" ON "startups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "verification_claims_startup_idx" ON "verification_claims" USING btree ("startup_id","created_at");--> statement-breakpoint
CREATE INDEX "video_events_video_time_idx" ON "video_events" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "video_events_viewer_time_idx" ON "video_events" USING btree ("viewer_key","created_at");--> statement-breakpoint
CREATE INDEX "video_likes_user_idx" ON "video_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_saves_user_idx" ON "video_saves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "videos_startup_idx" ON "videos" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "videos_founder_idx" ON "videos" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "videos_status_published_idx" ON "videos" USING btree ("status","published_at");--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "markets_startup_idx" ON "markets" USING btree ("startup_id");--> statement-breakpoint
ALTER TABLE "market_proposals" ADD CONSTRAINT "market_proposals_about_something" CHECK (("market_proposals"."venue_name" is not null and "market_proposals"."campus" is not null
      and "market_proposals"."category" is not null and "market_proposals"."window_start_at" is not null) or "market_proposals"."startup_id" is not null);--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_has_subject" CHECK ("markets"."subject_user_id" is not null or ("markets"."venue_id" is not null and "markets"."campus" is not null
        and "markets"."category" is not null and "markets"."resolution_source_id" is not null
        and "markets"."window_start_at" is not null and "markets"."window_end_at" is not null and "markets"."window_end_at" > "markets"."window_start_at"
        and "markets"."time_zone" is not null and "markets"."yes_condition" is not null and "markets"."no_condition" is not null
        and "markets"."evidence_deadline_at" >= "markets"."window_end_at")
        or ("markets"."startup_id" is not null and "markets"."milestone_kind" is not null and "markets"."resolution_source_id" is not null
        and "markets"."time_zone" is not null and "markets"."yes_condition" is not null and "markets"."no_condition" is not null));--> statement-breakpoint
-- Deny by default, as in 0001: only server code reaches these tables.
ALTER TABLE "founders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "startups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "startup_founders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "founder_follows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "startup_follows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "viewer_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "startup_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;

-- Proof attached to a goal by its own subject, decided 2026-09-19 (D06, D07).
-- The most sensitive table in the app: originals are kept permanently and are
-- never served to anyone but the owner. Row-level security below keeps the
-- browser publishable key from reading any of it, as on every other table.

CREATE TYPE "public"."evidence_kind" AS ENUM('file', 'link');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('submitted', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"original_path" text,
	"original_content_type" text,
	"original_bytes" integer,
	"published_path" text,
	"link_url" text,
	"caption" text,
	"status" "evidence_status" DEFAULT 'submitted' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_shape_matches_kind" CHECK (("evidence"."kind" = 'file' and "evidence"."original_path" is not null and "evidence"."link_url" is null)
          or ("evidence"."kind" = 'link' and "evidence"."link_url" is not null and "evidence"."original_path" is null)),
	CONSTRAINT "evidence_published_is_reviewed" CHECK ("evidence"."status" <> 'published'
          or ("evidence"."reviewed_by" is not null and "evidence"."reviewed_at" is not null
              and ("evidence"."kind" = 'link' or "evidence"."published_path" is not null))),
	CONSTRAINT "evidence_published_is_not_the_original" CHECK ("evidence"."published_path" is null or "evidence"."published_path" <> "evidence"."original_path")
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_market_idx" ON "evidence" USING btree ("market_id","created_at");--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."upload_intent_kind" AS ENUM('photo', 'evidence');--> statement-breakpoint
CREATE TABLE "feed_event_buckets" (
	"market_id" uuid NOT NULL,
	"kind" "feed_event_kind" NOT NULL,
	"bucket_at" timestamp with time zone NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "feed_event_buckets_pk" PRIMARY KEY("market_id","kind","bucket_at"),
	CONSTRAINT "feed_event_buckets_count_nonnegative" CHECK ("feed_event_buckets"."event_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid,
	"kind" "upload_intent_kind" NOT NULL,
	"object_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cleaning_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "feed_event_buckets" ADD CONSTRAINT "feed_event_buckets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_event_buckets_time_idx" ON "feed_event_buckets" USING btree ("bucket_at");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_intents_kind_path_uq" ON "upload_intents" USING btree ("kind","object_path");--> statement-breakpoint
CREATE INDEX "upload_intents_user_expiry_idx" ON "upload_intents" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "upload_intents_expiry_idx" ON "upload_intents" USING btree ("expires_at");
--> statement-breakpoint
-- The browser publishable key must not read or write server-owned counters or grants.
ALTER TABLE "feed_event_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "upload_intents" ENABLE ROW LEVEL SECURITY;

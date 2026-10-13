ALTER TYPE "public"."ledger_kind" ADD VALUE 'purchase_bonus';--> statement-breakpoint
ALTER TYPE "public"."ledger_kind" ADD VALUE 'qr_award';--> statement-breakpoint
CREATE TABLE "badge_products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_qr_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campus" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"radius_meters" integer NOT NULL,
	"reward_micro" bigint NOT NULL,
	"max_claims" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_qr_campaigns_campus_check" CHECK ("campus_qr_campaigns"."campus" in ('osu', 'uiuc')),
	CONSTRAINT "campus_qr_campaigns_radius_check" CHECK ("campus_qr_campaigns"."radius_meters" between 10 and 2000),
	CONSTRAINT "campus_qr_campaigns_reward_check" CHECK ("campus_qr_campaigns"."reward_micro" > 0),
	CONSTRAINT "campus_qr_campaigns_limit_check" CHECK ("campus_qr_campaigns"."max_claims" is null or "campus_qr_campaigns"."max_claims" > 0),
	CONSTRAINT "campus_qr_campaigns_window_check" CHECK ("campus_qr_campaigns"."ends_at" > "campus_qr_campaigns"."starts_at"),
	CONSTRAINT "campus_qr_campaigns_latitude_check" CHECK ("campus_qr_campaigns"."latitude"::numeric between -90 and 90),
	CONSTRAINT "campus_qr_campaigns_longitude_check" CHECK ("campus_qr_campaigns"."longitude"::numeric between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "campus_qr_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_micro" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_qr_claims_reward_check" CHECK ("campus_qr_claims"."reward_micro" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"silver_amount" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"gold_bonus_micro" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_payment_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "purchase_orders_silver_amount_check" CHECK ("purchase_orders"."silver_amount" between 100 and 1000 and "purchase_orders"."silver_amount" % 100 = 0),
	CONSTRAINT "purchase_orders_price_check" CHECK ("purchase_orders"."price_cents" = "purchase_orders"."silver_amount"),
	CONSTRAINT "purchase_orders_gold_bonus_check" CHECK ("purchase_orders"."gold_bonus_micro" = "purchase_orders"."silver_amount" * 1000000),
	CONSTRAINT "purchase_orders_status_check" CHECK ("purchase_orders"."status" in ('pending', 'paid', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "silver_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"purchase_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "silver_ledger_kind_check" CHECK ("silver_ledger_entries"."kind" in ('purchase', 'spend', 'adjustment')),
	CONSTRAINT "silver_ledger_nonzero_check" CHECK ("silver_ledger_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "silver_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_qr_campaigns" ADD CONSTRAINT "campus_qr_campaigns_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_qr_claims" ADD CONSTRAINT "campus_qr_claims_campaign_id_campus_qr_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campus_qr_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_qr_claims" ADD CONSTRAINT "campus_qr_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_badge_id_badge_products_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silver_ledger_entries" ADD CONSTRAINT "silver_ledger_entries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silver_wallets" ADD CONSTRAINT "silver_wallets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badge_products_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_purchase_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campus_qr_campaigns_token_hash_uq" ON "campus_qr_campaigns" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "campus_qr_campaigns_campus_idx" ON "campus_qr_campaigns" USING btree ("campus","active");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_qr_claims_campaign_user_uq" ON "campus_qr_claims" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "campus_qr_claims_campaign_idx" ON "campus_qr_claims" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_user_idem_uq" ON "purchase_orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_provider_payment_uq" ON "purchase_orders" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_user_created_idx" ON "purchase_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "silver_ledger_user_created_idx" ON "silver_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_purchase_uq" ON "user_badges" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "user_badges_user_idx" ON "user_badges" USING btree ("user_id","awarded_at");
--> statement-breakpoint
INSERT INTO "badge_products" ("id", "name", "description") VALUES
  ('campus-original', 'Campus Original', 'A clean Mitra badge for your profile.'),
  ('market-scout', 'Market Scout', 'A badge for following campus events.'),
  ('first-call', 'First Call', 'A badge for making your first forecast.');
--> statement-breakpoint
ALTER TABLE "badge_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campus_qr_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campus_qr_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "silver_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "silver_wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "badge_products", "campus_qr_campaigns", "campus_qr_claims", "purchase_orders", "silver_ledger_entries", "silver_wallets", "user_badges" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "badge_products", "campus_qr_campaigns", "campus_qr_claims", "purchase_orders", "silver_ledger_entries", "silver_wallets", "user_badges" FROM authenticated;
  END IF;
END $$;

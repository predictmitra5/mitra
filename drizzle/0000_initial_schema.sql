CREATE TYPE "public"."admin_action_kind" AS ENUM('approve', 'reject', 'close_early', 'rule', 'change_ruling', 'settle', 'cancel');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('signup_grant', 'refill', 'trade_buy', 'trade_sell', 'settlement', 'cancellation_refund');--> statement-breakpoint
CREATE TYPE "public"."market_outcome" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('draft', 'rejected', 'open', 'closed', 'ruled', 'settled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trade_action" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"kind" "admin_action_kind" NOT NULL,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount_micro" bigint NOT NULL,
	"market_id" uuid,
	"trade_id" uuid,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_outcome_deciders" (
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_outcome_deciders_market_id_user_id_pk" PRIMARY KEY("market_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"status" "market_status" DEFAULT 'draft' NOT NULL,
	"question" text NOT NULL,
	"resolution_criteria" text NOT NULL,
	"goal_type" text,
	"deadline_at" timestamp with time zone NOT NULL,
	"evidence_deadline_at" timestamp with time zone NOT NULL,
	"trading_closed_at" timestamp with time zone,
	"liquidity_micro" bigint NOT NULL,
	"opening_probability_bp" integer NOT NULL,
	"initial_yes_shares_micro" bigint NOT NULL,
	"initial_no_shares_micro" bigint NOT NULL,
	"yes_shares_micro" bigint NOT NULL,
	"no_shares_micro" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"ruled_at" timestamp with time zone,
	"ruled_outcome" "market_outcome",
	"ruling_reason" text,
	"contest_ends_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"yes_shares_micro" bigint DEFAULT 0 NOT NULL,
	"no_shares_micro" bigint DEFAULT 0 NOT NULL,
	"yes_cost_basis_micro" bigint DEFAULT 0 NOT NULL,
	"no_cost_basis_micro" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_market_id_user_id_pk" PRIMARY KEY("market_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"yes_price_bp" integer NOT NULL,
	"trade_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"is_owner" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"action" "trade_action" NOT NULL,
	"shares_micro" bigint NOT NULL,
	"amount_micro" bigint NOT NULL,
	"yes_price_before_bp" integer NOT NULL,
	"yes_price_after_bp" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_micro" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_outcome_deciders" ADD CONSTRAINT "market_outcome_deciders_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_outcome_deciders" ADD CONSTRAINT "market_outcome_deciders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_subject_user_id_profiles_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_market_idx" ON "admin_actions" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "contests_market_idx" ON "contests" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_user_created_idx" ON "ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_kind_idx" ON "ledger_entries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "markets_status_idx" ON "markets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "markets_subject_idx" ON "markets" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "markets_deadline_idx" ON "markets" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX "price_history_market_recorded_idx" ON "price_history" USING btree ("market_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_idempotency_key" ON "trades" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "trades_market_created_idx" ON "trades" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id");
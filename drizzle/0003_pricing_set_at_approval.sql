ALTER TABLE "markets" ALTER COLUMN "opening_probability_bp" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "initial_yes_shares_micro" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "initial_no_shares_micro" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "yes_shares_micro" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "no_shares_micro" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_priced_once_approved" CHECK ("markets"."approved_at" is null or ("markets"."opening_probability_bp" is not null
        and "markets"."initial_yes_shares_micro" is not null and "markets"."initial_no_shares_micro" is not null
        and "markets"."yes_shares_micro" is not null and "markets"."no_shares_micro" is not null));--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_trading_requires_approval" CHECK ("markets"."status" in ('draft', 'rejected', 'cancelled') or "markets"."approved_at" is not null);--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_opening_probability_range" CHECK ("markets"."opening_probability_bp" is null or "markets"."opening_probability_bp" between 1 and 9999);--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_evidence_after_deadline" CHECK ("markets"."evidence_deadline_at" >= "markets"."deadline_at");
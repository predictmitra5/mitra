-- Deny by default. The app reaches these tables only from server code, over the
-- pooled connection in src/db/client.ts. Enabling row level security with no
-- policies means the publishable key, which is exposed in the browser, can read
-- nothing through the Supabase REST API. Add narrow policies later only if a
-- browser client genuinely needs direct access.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "markets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "market_outcome_deciders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contests" ENABLE ROW LEVEL SECURITY;

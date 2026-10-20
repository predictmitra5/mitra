CREATE TABLE "exchange_journal" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" integer NOT NULL,
	"entry" jsonb NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_journal_sequence_unique" UNIQUE("sequence")
);
--> statement-breakpoint
CREATE TABLE "exchange_snapshot" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL,
	CONSTRAINT "exchange_singleton" CHECK ("exchange_snapshot"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE exchange_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exchange_snapshot, exchange_journal FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON exchange_snapshot,exchange_journal FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON exchange_snapshot,exchange_journal FROM authenticated; END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS exchange_internal;
REVOKE ALL ON SCHEMA exchange_internal FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION exchange_internal.journal_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE amount numeric; total numeric := 0; item jsonb;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Financial history is append-only'; END IF;
 IF jsonb_typeof(NEW.entry->'postings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Postings required'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.entry->'postings') LOOP
  amount := (item->>'cents')::numeric;
  IF amount IS NULL OR amount <> trunc(amount) OR abs(amount)>9007199254740991 OR item->>'account' IS NULL THEN RAISE EXCEPTION 'Invalid journal amount'; END IF;
  total := total + amount;
 END LOOP;
 IF total <> 0 THEN RAISE EXCEPTION 'Unbalanced financial journal'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION exchange_internal.journal_guard() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER exchange_journal_immutable BEFORE INSERT OR UPDATE OR DELETE ON exchange_journal FOR EACH ROW EXECUTE FUNCTION exchange_internal.journal_guard();
--> statement-breakpoint
CREATE FUNCTION exchange_internal.retired_mutation_closed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'This retired economy no longer accepts mutations'; END $$;
REVOKE ALL ON FUNCTION exchange_internal.retired_mutation_closed() FROM PUBLIC;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['wallets','ledger_entries','trades','positions','price_history','silver_wallets','silver_ledger_entries','badge_products','purchase_orders','user_badges','campus_qr_campaigns','campus_qr_claims','startup_orderbook_sandbox','startup_orderbook_sandbox_events'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('CREATE TRIGGER retired_mutations_closed BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION exchange_internal.retired_mutation_closed()',t); END IF;
 END LOOP;
END $$;

ALTER TYPE "public"."upload_intent_kind" ADD VALUE 'resume';--> statement-breakpoint
CREATE TABLE "startup_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startup_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"password_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "founders" ADD COLUMN "education_level" text;--> statement-breakpoint
ALTER TABLE "founders" ADD COLUMN "school" text;--> statement-breakpoint
ALTER TABLE "founders" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "founders" ADD COLUMN "resume_path" text;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_invites" ADD CONSTRAINT "startup_invites_claimed_by_profiles_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "startup_invites_token_hash_key" ON "startup_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "startup_invites_startup_idx" ON "startup_invites" USING btree ("startup_id","created_at");--> statement-breakpoint
CREATE INDEX "startup_invites_claimed_idx" ON "startup_invites" USING btree ("claimed_by");--> statement-breakpoint
ALTER TABLE "startup_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "startup_invites" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "startup_invites" FROM authenticated; END IF;
END $$;

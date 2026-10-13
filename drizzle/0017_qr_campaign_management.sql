ALTER TYPE "public"."admin_action_kind" ADD VALUE 'manage_qr_campaign';--> statement-breakpoint
ALTER TABLE "campus_qr_campaigns" ADD COLUMN "deleted_at" timestamp with time zone;

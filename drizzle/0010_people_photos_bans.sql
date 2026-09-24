ALTER TYPE "public"."admin_action_kind" ADD VALUE 'ban';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'unban';--> statement-breakpoint
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'remove_photo';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_path" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ban_reason" text;
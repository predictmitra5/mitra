ALTER TYPE "public"."admin_action_kind" ADD VALUE 'withdraw_account';--> statement-breakpoint
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_shape_matches_kind";--> statement-breakpoint
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_published_is_reviewed";--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_shape_matches_kind" CHECK ("evidence"."removed_at" is not null
          or ("evidence"."kind" = 'file' and "evidence"."original_path" is not null and "evidence"."link_url" is null)
          or ("evidence"."kind" = 'link' and "evidence"."link_url" is not null and "evidence"."original_path" is null));--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_published_is_reviewed" CHECK ("evidence"."status" <> 'published' or "evidence"."removed_at" is not null
          or ("evidence"."reviewed_by" is not null and "evidence"."reviewed_at" is not null
              and ("evidence"."kind" = 'link' or "evidence"."verified_statement" is not null)));
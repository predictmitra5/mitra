ALTER TABLE "evidence" DROP CONSTRAINT "evidence_published_is_reviewed";--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "verified_statement" text;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_published_is_reviewed" CHECK ("evidence"."status" <> 'published'
          or ("evidence"."reviewed_by" is not null and "evidence"."reviewed_at" is not null
              and ("evidence"."kind" = 'link' or "evidence"."verified_statement" is not null)));
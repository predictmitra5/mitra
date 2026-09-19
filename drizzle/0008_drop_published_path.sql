ALTER TABLE "evidence" DROP CONSTRAINT "evidence_published_is_not_the_original";--> statement-breakpoint
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_published_is_reviewed";--> statement-breakpoint
ALTER TABLE "evidence" DROP COLUMN "published_path";--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_published_is_reviewed" CHECK ("evidence"."status" <> 'published'
          or ("evidence"."reviewed_by" is not null and "evidence"."reviewed_at" is not null
              and "evidence"."kind" = 'link'));
ALTER TYPE "public"."admin_action_kind" ADD VALUE 'close_deadline' BEFORE 'rule';--> statement-breakpoint
ALTER TABLE "admin_actions" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "ruling_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "ruling_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_actions_request_key" ON "admin_actions" USING btree ("actor_user_id","request_id");
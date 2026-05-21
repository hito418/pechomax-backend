ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "recipient_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "water_type" text DEFAULT 'freshwater' NOT NULL;
--> statement-breakpoint
UPDATE "locations"
SET "water_type" = 'sea'
WHERE lower("name") LIKE '%port%'
  OR lower("name") LIKE '%mer%'
  OR lower("name") LIKE '%golfe%'
  OR lower("name") LIKE '%berre%'
  OR lower("description") LIKE '%lagune%'
  OR lower("description") LIKE '%marin%'
  OR lower("description") LIKE '%maree%';
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_water_type_check" CHECK ("water_type" in ('freshwater', 'sea'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

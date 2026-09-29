CREATE TABLE "product_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"day" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_events_kind_check" CHECK ("product_events"."kind" in ('view','bag','save','restock'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_events_once_a_day" ON "product_events" USING btree ("product_slug","kind","actor","day");--> statement-breakpoint
CREATE INDEX "product_events_at_idx" ON "product_events" USING btree ("at");--> statement-breakpoint
ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "product_events" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "product_events" FROM authenticated; END IF;
END $$;

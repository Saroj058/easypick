CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000001 CACHE 1;--> statement-breakpoint
CREATE TABLE "order_lines" (
	"order_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"sku" text NOT NULL,
	"slug" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" text,
	"staff_name" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"ref" text,
	"actor" text,
	"stock_after" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "orders_status_idx";--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "role" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sku_variants_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."variants"("sku") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_pk" ON "order_lines" USING btree ("order_id","line_no");--> statement-breakpoint
CREATE INDEX "order_lines_sku_idx" ON "order_lines" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "staff_events_at_idx" ON "staff_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "stock_movements_sku_idx" ON "stock_movements" USING btree ("sku","at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "otps_expires_idx" ON "otps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "restock_waiting_idx" ON "restock_alerts" USING btree ("sku") WHERE "restock_alerts"."notified_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_username_lower_idx" ON "staff" USING btree (lower("username"));--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_status_check" CHECK ("gift_cards"."status" in ('pending_payment','active','blocked'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('awaiting_payment','paid','ready_for_pickup','out_for_delivery','completed','expired','cancelled'));--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_role_check" CHECK ("staff"."role" in ('owner','helper'));--> statement-breakpoint
INSERT INTO "order_lines" ("order_id", "line_no", "sku", "slug", "qty", "unit_price")
SELECT o.id, (l.ord - 1)::int, l.line->>'sku', l.line->>'slug', (l.line->>'qty')::int, (l.line->>'unitPrice')::int
FROM "orders" o, jsonb_array_elements(o.data->'lines') WITH ORDINALITY AS l(line, ord)
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
DECLARE r text;
BEGIN
  -- Supabase: the site talks to Postgres directly, so its public REST roles need no table access at all.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;

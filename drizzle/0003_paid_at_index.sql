CREATE INDEX "orders_paid_at_idx" ON "orders" USING btree ("paid_at" DESC NULLS LAST) WHERE "orders"."paid_at" is not null;--> statement-breakpoint
-- Hand-written: fill paid_at for any paid order whose column was never set, so "paid" means paid_at is not null.
UPDATE "orders" SET "paid_at" = ("data"->>'paidAt')::timestamptz WHERE "paid_at" IS NULL AND "data" ? 'paidAt';

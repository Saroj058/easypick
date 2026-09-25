CREATE TABLE "drops" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"story" text NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"piece_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"order_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"code" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"value" integer NOT NULL,
	"balance" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"order_id" text,
	"data" jsonb NOT NULL,
	CONSTRAINT "gift_cards_balance_nonneg" CHECK ("gift_cards"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"phone" text NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"kind" text DEFAULT 'goods' NOT NULL,
	"gift_token" text,
	"total" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"data" jsonb NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_gift_token_unique" UNIQUE("gift_token")
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"phone" text PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"tries_left" integer NOT NULL,
	"sent_at" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"slug" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restock_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"sku" text NOT NULL,
	"size" text NOT NULL,
	"colour" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"contact_phone" text,
	"name" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"google_id" text,
	"facebook_id" text,
	"alerts" boolean DEFAULT false NOT NULL,
	"fit" jsonb,
	"checkout" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"last_login_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_facebook_id_unique" UNIQUE("facebook_id")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"sku" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"size" text NOT NULL,
	"colour" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"last_piece_on_floor" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "variants_stock_nonneg" CHECK ("variants"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_slug_products_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."products"("slug") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "restock_sku_idx" ON "restock_alerts" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_slug");
CREATE TABLE "drop_alert_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"contact" text NOT NULL,
	"source" text,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"last_drop_sent" text,
	CONSTRAINT "drop_alert_channel_check" CHECK ("drop_alert_subscribers"."channel" in ('whatsapp','email'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drop_alert_contact_idx" ON "drop_alert_subscribers" USING btree ("channel","contact");--> statement-breakpoint
CREATE UNIQUE INDEX "drop_alert_token_idx" ON "drop_alert_subscribers" USING btree ("token");
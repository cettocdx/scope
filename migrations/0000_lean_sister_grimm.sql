CREATE TABLE "portfolio_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"item_name" text NOT NULL,
	"category" text NOT NULL,
	"estimated_price" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"purchase_price" real NOT NULL,
	"trend_percentage" real DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 85 NOT NULL,
	"investment_rating" varchar(10) NOT NULL,
	"is_authentic" boolean DEFAULT true NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deals" jsonb DEFAULT '[]'::jsonb,
	"image_base64" text,
	"date_added" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX "idx_portfolio_device" ON "portfolio_assets" USING btree ("device_id","date_added");
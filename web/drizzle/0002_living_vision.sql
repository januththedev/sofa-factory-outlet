CREATE TABLE "lead_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"actor_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"request_hash" text NOT NULL,
	"fingerprint" text NOT NULL,
	"customer_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"city" text,
	"preferred_contact" text NOT NULL,
	"notes" text,
	"budget" text,
	"room" text,
	"items" jsonb NOT NULL,
	"attribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"assignee_id" integer,
	"follow_up_at" timestamp with time zone,
	"lost_reason" text,
	"priority" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_reference_unique" UNIQUE("reference"),
	CONSTRAINT "leads_request_hash_unique" UNIQUE("request_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_hash" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contact_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "lead_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_admin_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activities_lead_idx" ON "lead_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_queue_idx" ON "leads" USING btree ("stage","follow_up_at");--> statement-breakpoint
CREATE INDEX "leads_assignee_idx" ON "leads" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "rate_buckets_expiry_idx" ON "rate_buckets" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_access_hash_unique" UNIQUE("access_hash");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_unique" UNIQUE("lead_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_key_unique" UNIQUE("request_key");
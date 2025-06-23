create extension if not exists "pgjwt" with schema "extensions";


create table "public"."channels" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid,
    "type" text not null,
    "name" text not null,
    "credentials" jsonb not null,
    "webhook_url" text,
    "status" text default 'inactive'::text,
    "created_at" timestamp without time zone default now()
);


create table "public"."companies" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp without time zone default now()
);


create table "public"."event_store" (
    "id" uuid not null,
    "event_type" text not null,
    "tenant_id" uuid not null,
    "payload" jsonb not null,
    "timestamp" timestamp with time zone not null,
    "created_at" timestamp with time zone default now(),
    "sequence_number" bigint not null,
    "job_id" character varying,
    "workflow_id" character varying,
    "status" character varying default 'processed'::character varying
);


create table "public"."execution_steps" (
    "id" uuid not null default gen_random_uuid(),
    "execution_id" uuid,
    "step_name" text not null,
    "step_type" text not null,
    "status" text not null,
    "input_data" jsonb,
    "output_data" jsonb,
    "error_message" text,
    "started_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
);


alter table "public"."execution_steps" enable row level security;

create table "public"."scheduled_events" (
    "id" uuid not null,
    "workflowid" uuid not null,
    "nodeid" character varying(255) not null,
    "clientid" character varying(255) not null,
    "data" jsonb not null,
    "schedule" jsonb,
    "lastrun" timestamp without time zone,
    "nextrun" timestamp without time zone,
    "status" character varying(50) default 'active'::character varying,
    "metadata" jsonb,
    "createdat" timestamp without time zone not null default now(),
    "updatedat" timestamp without time zone not null default now()
);


create table "public"."subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" text,
    "stripe_id" text,
    "price_id" text,
    "stripe_price_id" text,
    "currency" text,
    "interval" text,
    "status" text,
    "current_period_start" bigint,
    "current_period_end" bigint,
    "cancel_at_period_end" boolean,
    "amount" bigint,
    "started_at" bigint,
    "ends_at" bigint,
    "ended_at" bigint,
    "canceled_at" bigint,
    "customer_cancellation_reason" text,
    "customer_cancellation_comment" text,
    "metadata" jsonb,
    "custom_field_data" jsonb,
    "customer_id" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."subscriptions" enable row level security;

create table "public"."users" (
    "id" uuid not null,
    "avatar_url" text,
    "user_id" text,
    "token_identifier" text not null,
    "subscription" text,
    "credits" text,
    "image" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone,
    "email" text,
    "name" text,
    "full_name" text,
    "company_id" uuid
);


alter table "public"."users" enable row level security;

create table "public"."webhook_events" (
    "id" uuid not null default gen_random_uuid(),
    "event_type" text not null,
    "type" text not null,
    "stripe_event_id" text,
    "data" jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "modified_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."webhook_events" enable row level security;

create table "public"."webhooks" (
    "id" uuid not null default gen_random_uuid(),
    "channel_id" uuid,
    "event_type" text not null,
    "payload" jsonb not null,
    "received_at" timestamp without time zone default now()
);


create table "public"."workflow_executions" (
    "id" uuid not null default gen_random_uuid(),
    "workflow_id" uuid,
    "execution_id" text not null,
    "status" text not null,
    "trigger_payload" jsonb,
    "step_results" jsonb default '{}'::jsonb,
    "error_message" text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
);


alter table "public"."workflow_executions" enable row level security;

create table "public"."workflow_triggers" (
    "id" uuid not null default gen_random_uuid(),
    "workflow_id" uuid,
    "trigger_type" text not null,
    "webhook_url" text,
    "webhook_secret" text,
    "schedule_cron" text,
    "settings" jsonb default '{}'::jsonb,
    "status" text default 'active'::text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."workflow_triggers" enable row level security;

create table "public"."workflows" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "nodes" jsonb not null,
    "edges" jsonb not null,
    "tenant_id" uuid not null,
    "version" integer not null default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "tags" text[] default '{}'::text[],
    "status" text not null default 'draft'::text,
    "definition" jsonb not null,
    "created_by" uuid
);


alter table "public"."workflows" enable row level security;

CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX event_store_pkey ON public.event_store USING btree (id);

CREATE UNIQUE INDEX execution_steps_pkey ON public.execution_steps USING btree (id);

CREATE INDEX idx_event_store_event_type ON public.event_store USING btree (event_type);

CREATE INDEX idx_event_store_job_id ON public.event_store USING btree (job_id);

CREATE INDEX idx_event_store_sequence ON public.event_store USING btree (sequence_number);

CREATE INDEX idx_event_store_status ON public.event_store USING btree (status);

CREATE INDEX idx_event_store_tenant ON public.event_store USING btree (tenant_id);

CREATE INDEX idx_event_store_tenant_id ON public.event_store USING btree (tenant_id);

CREATE INDEX idx_event_store_timestamp ON public.event_store USING btree ("timestamp");

CREATE INDEX idx_event_store_type ON public.event_store USING btree (event_type);

CREATE INDEX idx_event_store_workflow_id ON public.event_store USING btree (workflow_id);

CREATE INDEX idx_execution_steps_created_at ON public.execution_steps USING btree (created_at);

CREATE INDEX idx_execution_steps_execution_id ON public.execution_steps USING btree (execution_id);

CREATE INDEX idx_execution_steps_status ON public.execution_steps USING btree (status);

CREATE INDEX idx_scheduled_events_client ON public.scheduled_events USING btree (clientid);

CREATE INDEX idx_scheduled_events_nextrun ON public.scheduled_events USING btree (nextrun) WHERE ((status)::text = 'active'::text);

CREATE INDEX idx_workflow_executions_created_at ON public.workflow_executions USING btree (created_at DESC);

CREATE INDEX idx_workflow_executions_execution_id ON public.workflow_executions USING btree (execution_id);

CREATE INDEX idx_workflow_executions_status ON public.workflow_executions USING btree (status);

CREATE INDEX idx_workflow_executions_workflow_id ON public.workflow_executions USING btree (workflow_id);

CREATE INDEX idx_workflow_triggers_trigger_type ON public.workflow_triggers USING btree (trigger_type);

CREATE INDEX idx_workflow_triggers_webhook_url ON public.workflow_triggers USING btree (webhook_url);

CREATE INDEX idx_workflow_triggers_workflow_id ON public.workflow_triggers USING btree (workflow_id);

CREATE INDEX idx_workflows_status ON public.workflows USING btree (status);

CREATE INDEX idx_workflows_tenant ON public.workflows USING btree (tenant_id);

CREATE UNIQUE INDEX scheduled_events_pkey ON public.scheduled_events USING btree (id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE INDEX subscriptions_stripe_id_idx ON public.subscriptions USING btree (stripe_id);

CREATE UNIQUE INDEX subscriptions_stripe_id_key ON public.subscriptions USING btree (stripe_id);

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_user_id_key ON public.users USING btree (user_id);

CREATE INDEX webhook_events_event_type_idx ON public.webhook_events USING btree (event_type);

CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id);

CREATE INDEX webhook_events_stripe_event_id_idx ON public.webhook_events USING btree (stripe_event_id);

CREATE INDEX webhook_events_type_idx ON public.webhook_events USING btree (type);

CREATE UNIQUE INDEX webhooks_pkey ON public.webhooks USING btree (id);

CREATE UNIQUE INDEX workflow_executions_execution_id_key ON public.workflow_executions USING btree (execution_id);

CREATE UNIQUE INDEX workflow_executions_pkey ON public.workflow_executions USING btree (id);

CREATE UNIQUE INDEX workflow_triggers_pkey ON public.workflow_triggers USING btree (id);

CREATE UNIQUE INDEX workflows_pkey ON public.workflows USING btree (id);

alter table "public"."channels" add constraint "channels_pkey" PRIMARY KEY using index "channels_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."event_store" add constraint "event_store_pkey" PRIMARY KEY using index "event_store_pkey";

alter table "public"."execution_steps" add constraint "execution_steps_pkey" PRIMARY KEY using index "execution_steps_pkey";

alter table "public"."scheduled_events" add constraint "scheduled_events_pkey" PRIMARY KEY using index "scheduled_events_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."webhook_events" add constraint "webhook_events_pkey" PRIMARY KEY using index "webhook_events_pkey";

alter table "public"."webhooks" add constraint "webhooks_pkey" PRIMARY KEY using index "webhooks_pkey";

alter table "public"."workflow_executions" add constraint "workflow_executions_pkey" PRIMARY KEY using index "workflow_executions_pkey";

alter table "public"."workflow_triggers" add constraint "workflow_triggers_pkey" PRIMARY KEY using index "workflow_triggers_pkey";

alter table "public"."workflows" add constraint "workflows_pkey" PRIMARY KEY using index "workflows_pkey";

alter table "public"."channels" add constraint "channels_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) not valid;

alter table "public"."channels" validate constraint "channels_company_id_fkey";

alter table "public"."channels" add constraint "channels_type_check" CHECK ((type = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'mercado_livre'::text]))) not valid;

alter table "public"."channels" validate constraint "channels_type_check";

alter table "public"."execution_steps" add constraint "execution_steps_execution_id_fkey" FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE not valid;

alter table "public"."execution_steps" validate constraint "execution_steps_execution_id_fkey";

alter table "public"."execution_steps" add constraint "execution_steps_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'skipped'::text]))) not valid;

alter table "public"."execution_steps" validate constraint "execution_steps_status_check";

alter table "public"."execution_steps" add constraint "execution_steps_step_type_check" CHECK ((step_type = ANY (ARRAY['trigger'::text, 'action'::text]))) not valid;

alter table "public"."execution_steps" validate constraint "execution_steps_step_type_check";

alter table "public"."scheduled_events" add constraint "scheduled_events_workflowid_fkey" FOREIGN KEY (workflowid) REFERENCES workflows(id) not valid;

alter table "public"."scheduled_events" validate constraint "scheduled_events_workflowid_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_stripe_id_key" UNIQUE using index "subscriptions_stripe_id_key";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(user_id) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."users" add constraint "fk_users_companies" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL not valid;

alter table "public"."users" validate constraint "fk_users_companies";

alter table "public"."users" add constraint "users_user_id_key" UNIQUE using index "users_user_id_key";

alter table "public"."webhooks" add constraint "webhooks_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES channels(id) not valid;

alter table "public"."webhooks" validate constraint "webhooks_channel_id_fkey";

alter table "public"."workflow_executions" add constraint "workflow_executions_execution_id_key" UNIQUE using index "workflow_executions_execution_id_key";

alter table "public"."workflow_executions" add constraint "workflow_executions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."workflow_executions" validate constraint "workflow_executions_status_check";

alter table "public"."workflow_executions" add constraint "workflow_executions_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE not valid;

alter table "public"."workflow_executions" validate constraint "workflow_executions_workflow_id_fkey";

alter table "public"."workflow_triggers" add constraint "workflow_triggers_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."workflow_triggers" validate constraint "workflow_triggers_status_check";

alter table "public"."workflow_triggers" add constraint "workflow_triggers_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['webhook'::text, 'schedule'::text, 'manual'::text]))) not valid;

alter table "public"."workflow_triggers" validate constraint "workflow_triggers_trigger_type_check";

alter table "public"."workflow_triggers" add constraint "workflow_triggers_workflow_id_fkey" FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE not valid;

alter table "public"."workflow_triggers" validate constraint "workflow_triggers_workflow_id_fkey";

alter table "public"."workflows" add constraint "workflows_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."workflows" validate constraint "workflows_created_by_fkey";

alter table "public"."workflows" add constraint "workflows_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]))) not valid;

alter table "public"."workflows" validate constraint "workflows_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (
    id,
    user_id,
    email,
    name,
    full_name,
    avatar_url,
    token_identifier,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id::text,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = NEW.raw_user_meta_data->>'name',
    full_name = NEW.raw_user_meta_data->>'full_name',
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NEW.updated_at
  WHERE user_id = NEW.id::text;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."channels" to "anon";

grant insert on table "public"."channels" to "anon";

grant references on table "public"."channels" to "anon";

grant select on table "public"."channels" to "anon";

grant trigger on table "public"."channels" to "anon";

grant truncate on table "public"."channels" to "anon";

grant update on table "public"."channels" to "anon";

grant delete on table "public"."channels" to "authenticated";

grant insert on table "public"."channels" to "authenticated";

grant references on table "public"."channels" to "authenticated";

grant select on table "public"."channels" to "authenticated";

grant trigger on table "public"."channels" to "authenticated";

grant truncate on table "public"."channels" to "authenticated";

grant update on table "public"."channels" to "authenticated";

grant delete on table "public"."channels" to "service_role";

grant insert on table "public"."channels" to "service_role";

grant references on table "public"."channels" to "service_role";

grant select on table "public"."channels" to "service_role";

grant trigger on table "public"."channels" to "service_role";

grant truncate on table "public"."channels" to "service_role";

grant update on table "public"."channels" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."event_store" to "anon";

grant insert on table "public"."event_store" to "anon";

grant references on table "public"."event_store" to "anon";

grant select on table "public"."event_store" to "anon";

grant trigger on table "public"."event_store" to "anon";

grant truncate on table "public"."event_store" to "anon";

grant update on table "public"."event_store" to "anon";

grant delete on table "public"."event_store" to "authenticated";

grant insert on table "public"."event_store" to "authenticated";

grant references on table "public"."event_store" to "authenticated";

grant select on table "public"."event_store" to "authenticated";

grant trigger on table "public"."event_store" to "authenticated";

grant truncate on table "public"."event_store" to "authenticated";

grant update on table "public"."event_store" to "authenticated";

grant delete on table "public"."event_store" to "service_role";

grant insert on table "public"."event_store" to "service_role";

grant references on table "public"."event_store" to "service_role";

grant select on table "public"."event_store" to "service_role";

grant trigger on table "public"."event_store" to "service_role";

grant truncate on table "public"."event_store" to "service_role";

grant update on table "public"."event_store" to "service_role";

grant delete on table "public"."execution_steps" to "anon";

grant insert on table "public"."execution_steps" to "anon";

grant references on table "public"."execution_steps" to "anon";

grant select on table "public"."execution_steps" to "anon";

grant trigger on table "public"."execution_steps" to "anon";

grant truncate on table "public"."execution_steps" to "anon";

grant update on table "public"."execution_steps" to "anon";

grant delete on table "public"."execution_steps" to "authenticated";

grant insert on table "public"."execution_steps" to "authenticated";

grant references on table "public"."execution_steps" to "authenticated";

grant select on table "public"."execution_steps" to "authenticated";

grant trigger on table "public"."execution_steps" to "authenticated";

grant truncate on table "public"."execution_steps" to "authenticated";

grant update on table "public"."execution_steps" to "authenticated";

grant delete on table "public"."execution_steps" to "service_role";

grant insert on table "public"."execution_steps" to "service_role";

grant references on table "public"."execution_steps" to "service_role";

grant select on table "public"."execution_steps" to "service_role";

grant trigger on table "public"."execution_steps" to "service_role";

grant truncate on table "public"."execution_steps" to "service_role";

grant update on table "public"."execution_steps" to "service_role";

grant delete on table "public"."scheduled_events" to "anon";

grant insert on table "public"."scheduled_events" to "anon";

grant references on table "public"."scheduled_events" to "anon";

grant select on table "public"."scheduled_events" to "anon";

grant trigger on table "public"."scheduled_events" to "anon";

grant truncate on table "public"."scheduled_events" to "anon";

grant update on table "public"."scheduled_events" to "anon";

grant delete on table "public"."scheduled_events" to "authenticated";

grant insert on table "public"."scheduled_events" to "authenticated";

grant references on table "public"."scheduled_events" to "authenticated";

grant select on table "public"."scheduled_events" to "authenticated";

grant trigger on table "public"."scheduled_events" to "authenticated";

grant truncate on table "public"."scheduled_events" to "authenticated";

grant update on table "public"."scheduled_events" to "authenticated";

grant delete on table "public"."scheduled_events" to "service_role";

grant insert on table "public"."scheduled_events" to "service_role";

grant references on table "public"."scheduled_events" to "service_role";

grant select on table "public"."scheduled_events" to "service_role";

grant trigger on table "public"."scheduled_events" to "service_role";

grant truncate on table "public"."scheduled_events" to "service_role";

grant update on table "public"."scheduled_events" to "service_role";

grant delete on table "public"."subscriptions" to "anon";

grant insert on table "public"."subscriptions" to "anon";

grant references on table "public"."subscriptions" to "anon";

grant select on table "public"."subscriptions" to "anon";

grant trigger on table "public"."subscriptions" to "anon";

grant truncate on table "public"."subscriptions" to "anon";

grant update on table "public"."subscriptions" to "anon";

grant delete on table "public"."subscriptions" to "authenticated";

grant insert on table "public"."subscriptions" to "authenticated";

grant references on table "public"."subscriptions" to "authenticated";

grant select on table "public"."subscriptions" to "authenticated";

grant trigger on table "public"."subscriptions" to "authenticated";

grant truncate on table "public"."subscriptions" to "authenticated";

grant update on table "public"."subscriptions" to "authenticated";

grant delete on table "public"."subscriptions" to "service_role";

grant insert on table "public"."subscriptions" to "service_role";

grant references on table "public"."subscriptions" to "service_role";

grant select on table "public"."subscriptions" to "service_role";

grant trigger on table "public"."subscriptions" to "service_role";

grant truncate on table "public"."subscriptions" to "service_role";

grant update on table "public"."subscriptions" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."webhook_events" to "anon";

grant insert on table "public"."webhook_events" to "anon";

grant references on table "public"."webhook_events" to "anon";

grant select on table "public"."webhook_events" to "anon";

grant trigger on table "public"."webhook_events" to "anon";

grant truncate on table "public"."webhook_events" to "anon";

grant update on table "public"."webhook_events" to "anon";

grant delete on table "public"."webhook_events" to "authenticated";

grant insert on table "public"."webhook_events" to "authenticated";

grant references on table "public"."webhook_events" to "authenticated";

grant select on table "public"."webhook_events" to "authenticated";

grant trigger on table "public"."webhook_events" to "authenticated";

grant truncate on table "public"."webhook_events" to "authenticated";

grant update on table "public"."webhook_events" to "authenticated";

grant delete on table "public"."webhook_events" to "service_role";

grant insert on table "public"."webhook_events" to "service_role";

grant references on table "public"."webhook_events" to "service_role";

grant select on table "public"."webhook_events" to "service_role";

grant trigger on table "public"."webhook_events" to "service_role";

grant truncate on table "public"."webhook_events" to "service_role";

grant update on table "public"."webhook_events" to "service_role";

grant delete on table "public"."webhooks" to "anon";

grant insert on table "public"."webhooks" to "anon";

grant references on table "public"."webhooks" to "anon";

grant select on table "public"."webhooks" to "anon";

grant trigger on table "public"."webhooks" to "anon";

grant truncate on table "public"."webhooks" to "anon";

grant update on table "public"."webhooks" to "anon";

grant delete on table "public"."webhooks" to "authenticated";

grant insert on table "public"."webhooks" to "authenticated";

grant references on table "public"."webhooks" to "authenticated";

grant select on table "public"."webhooks" to "authenticated";

grant trigger on table "public"."webhooks" to "authenticated";

grant truncate on table "public"."webhooks" to "authenticated";

grant update on table "public"."webhooks" to "authenticated";

grant delete on table "public"."webhooks" to "service_role";

grant insert on table "public"."webhooks" to "service_role";

grant references on table "public"."webhooks" to "service_role";

grant select on table "public"."webhooks" to "service_role";

grant trigger on table "public"."webhooks" to "service_role";

grant truncate on table "public"."webhooks" to "service_role";

grant update on table "public"."webhooks" to "service_role";

grant delete on table "public"."workflow_executions" to "anon";

grant insert on table "public"."workflow_executions" to "anon";

grant references on table "public"."workflow_executions" to "anon";

grant select on table "public"."workflow_executions" to "anon";

grant trigger on table "public"."workflow_executions" to "anon";

grant truncate on table "public"."workflow_executions" to "anon";

grant update on table "public"."workflow_executions" to "anon";

grant delete on table "public"."workflow_executions" to "authenticated";

grant insert on table "public"."workflow_executions" to "authenticated";

grant references on table "public"."workflow_executions" to "authenticated";

grant select on table "public"."workflow_executions" to "authenticated";

grant trigger on table "public"."workflow_executions" to "authenticated";

grant truncate on table "public"."workflow_executions" to "authenticated";

grant update on table "public"."workflow_executions" to "authenticated";

grant delete on table "public"."workflow_executions" to "service_role";

grant insert on table "public"."workflow_executions" to "service_role";

grant references on table "public"."workflow_executions" to "service_role";

grant select on table "public"."workflow_executions" to "service_role";

grant trigger on table "public"."workflow_executions" to "service_role";

grant truncate on table "public"."workflow_executions" to "service_role";

grant update on table "public"."workflow_executions" to "service_role";

grant delete on table "public"."workflow_triggers" to "anon";

grant insert on table "public"."workflow_triggers" to "anon";

grant references on table "public"."workflow_triggers" to "anon";

grant select on table "public"."workflow_triggers" to "anon";

grant trigger on table "public"."workflow_triggers" to "anon";

grant truncate on table "public"."workflow_triggers" to "anon";

grant update on table "public"."workflow_triggers" to "anon";

grant delete on table "public"."workflow_triggers" to "authenticated";

grant insert on table "public"."workflow_triggers" to "authenticated";

grant references on table "public"."workflow_triggers" to "authenticated";

grant select on table "public"."workflow_triggers" to "authenticated";

grant trigger on table "public"."workflow_triggers" to "authenticated";

grant truncate on table "public"."workflow_triggers" to "authenticated";

grant update on table "public"."workflow_triggers" to "authenticated";

grant delete on table "public"."workflow_triggers" to "service_role";

grant insert on table "public"."workflow_triggers" to "service_role";

grant references on table "public"."workflow_triggers" to "service_role";

grant select on table "public"."workflow_triggers" to "service_role";

grant trigger on table "public"."workflow_triggers" to "service_role";

grant truncate on table "public"."workflow_triggers" to "service_role";

grant update on table "public"."workflow_triggers" to "service_role";

grant delete on table "public"."workflows" to "anon";

grant insert on table "public"."workflows" to "anon";

grant references on table "public"."workflows" to "anon";

grant select on table "public"."workflows" to "anon";

grant trigger on table "public"."workflows" to "anon";

grant truncate on table "public"."workflows" to "anon";

grant update on table "public"."workflows" to "anon";

grant delete on table "public"."workflows" to "authenticated";

grant insert on table "public"."workflows" to "authenticated";

grant references on table "public"."workflows" to "authenticated";

grant select on table "public"."workflows" to "authenticated";

grant trigger on table "public"."workflows" to "authenticated";

grant truncate on table "public"."workflows" to "authenticated";

grant update on table "public"."workflows" to "authenticated";

grant delete on table "public"."workflows" to "service_role";

grant insert on table "public"."workflows" to "service_role";

grant references on table "public"."workflows" to "service_role";

grant select on table "public"."workflows" to "service_role";

grant trigger on table "public"."workflows" to "service_role";

grant truncate on table "public"."workflows" to "service_role";

grant update on table "public"."workflows" to "service_role";

create policy "Service role can manage execution steps"
on "public"."execution_steps"
as permissive
for all
to service_role
using (true);


create policy "Users can create execution steps for their workflows"
on "public"."execution_steps"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM (workflow_executions we
     JOIN workflows w ON ((w.id = we.workflow_id)))
  WHERE ((we.id = execution_steps.execution_id) AND (w.created_by = auth.uid())))));


create policy "Users can update execution steps for their workflows"
on "public"."execution_steps"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM (workflow_executions we
     JOIN workflows w ON ((w.id = we.workflow_id)))
  WHERE ((we.id = execution_steps.execution_id) AND (w.created_by = auth.uid())))));


create policy "Users can view execution steps for their workflows"
on "public"."execution_steps"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM (workflow_executions we
     JOIN workflows w ON ((w.id = we.workflow_id)))
  WHERE ((we.id = execution_steps.execution_id) AND (w.created_by = auth.uid())))));


create policy "Users can view own subscriptions"
on "public"."subscriptions"
as permissive
for select
to public
using (((auth.uid())::text = user_id));


create policy "Users can view own data"
on "public"."users"
as permissive
for select
to public
using (((auth.uid())::text = user_id));


create policy "Service role can manage webhook events"
on "public"."webhook_events"
as permissive
for all
to service_role
using (true);


create policy "Service role can manage executions"
on "public"."workflow_executions"
as permissive
for all
to service_role
using (true);


create policy "Users can create executions for their workflows"
on "public"."workflow_executions"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM workflows
  WHERE ((workflows.id = workflow_executions.workflow_id) AND (workflows.created_by = auth.uid())))));


create policy "Users can update executions of their workflows"
on "public"."workflow_executions"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM workflows
  WHERE ((workflows.id = workflow_executions.workflow_id) AND (workflows.created_by = auth.uid())))));


create policy "Users can view executions of their workflows"
on "public"."workflow_executions"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM workflows
  WHERE ((workflows.id = workflow_executions.workflow_id) AND (workflows.created_by = auth.uid())))));


create policy "Service role can read triggers"
on "public"."workflow_triggers"
as permissive
for select
to service_role
using (true);


create policy "Users can manage triggers for their workflows"
on "public"."workflow_triggers"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM workflows
  WHERE ((workflows.id = workflow_triggers.workflow_id) AND (workflows.created_by = auth.uid())))));


create policy "Service role can read workflows"
on "public"."workflows"
as permissive
for select
to service_role
using (true);


create policy "Users can create workflows"
on "public"."workflows"
as permissive
for insert
to public
with check ((created_by = auth.uid()));


create policy "Users can delete their own workflows"
on "public"."workflows"
as permissive
for delete
to public
using ((created_by = auth.uid()));


create policy "Users can update their own workflows"
on "public"."workflows"
as permissive
for update
to public
using ((created_by = auth.uid()))
with check ((created_by = auth.uid()));


create policy "Users can view their own workflows"
on "public"."workflows"
as permissive
for select
to public
using ((created_by = auth.uid()));


CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



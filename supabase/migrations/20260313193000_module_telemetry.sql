-- Create module_telemetry table for Phase 5 Advanced Analytics
create table "public"."module_telemetry" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null references auth.users(id) on delete cascade,
    "pack_id" uuid not null references public.packs(id) on delete cascade,
    "module_key" text not null,
    "section_id" text,
    "time_spent_seconds" numeric not null default 0,
    "scroll_depth_percent" numeric not null default 0,
    "help_requested" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."module_telemetry" add constraint "module_telemetry_pkey" PRIMARY KEY ("id");

-- RLS Policies
alter table "public"."module_telemetry" enable row level security;

create policy "Enable insert for authenticated users" on "public"."module_telemetry"
    for insert with check (auth.role() = 'authenticated');

create policy "Enable read for pack admins and authors" on "public"."module_telemetry"
    for select using (
        exists (
            select 1 from public.pack_members r
            where r.pack_id = module_telemetry.pack_id
            and r.user_id = auth.uid()
            and r.access_level in ('admin', 'author')
        )
    );

-- Index for analytics performance
create index "module_telemetry_pack_module_idx" on "public"."module_telemetry" ("pack_id", "module_key");
create index "module_telemetry_user_id_idx" on "public"."module_telemetry" ("user_id");

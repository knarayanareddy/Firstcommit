create table "public"."knowledge_owners" (
    "id" uuid not null default gen_random_uuid(),
    "source_id" uuid not null,
    "user_email" text not null,
    "ownership_score" numeric not null default 0,
    "last_synced_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);

alter table "public"."knowledge_owners" add constraint "knowledge_owners_pkey" PRIMARY KEY ("id");
alter table "public"."knowledge_owners" add constraint "knowledge_owners_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."pack_sources"("id") ON DELETE CASCADE;

create table "public"."author_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "slack_handle" text,
    "teams_handle" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);

alter table "public"."author_profiles" add constraint "author_profiles_pkey" PRIMARY KEY ("id");
alter table "public"."author_profiles" add constraint "author_profiles_email_key" UNIQUE ("email");

-- RLS Policies
alter table "public"."knowledge_owners" enable row level security;
alter table "public"."author_profiles" enable row level security;

create policy "Enable read access for all users" on "public"."knowledge_owners"
    for select using (auth.role() = 'authenticated');

create policy "Enable read access for all users" on "public"."author_profiles"
    for select using (auth.role() = 'authenticated');

create policy "Enable write for authors" on "public"."knowledge_owners"
    for all using (
        exists (
            select 1 from public.pack_sources s
            join public.packs p on p.id = s.pack_id
            join public.pack_members r on r.pack_id = p.id
            where s.id = knowledge_owners.source_id
            and r.user_id = auth.uid()
            and r.access_level = 'author'
        )
    );

create policy "Enable write for self" on "public"."author_profiles"
    for all using (auth.email() = email);

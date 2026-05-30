-- FAQ Entries table
create table if not exists faq_entries (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  question text not null,
  answer_markdown text not null,
  source text not null default 'manual' check (source in ('chat','discussion','manual')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  tags text[] default '{}',
  related_module_key text,
  related_section_id text,
  status text default 'published' check (status in ('draft','published','archived'))
);

alter table faq_entries enable row level security;

-- All pack members can read published entries
create policy "faq_entries_read" on faq_entries
  for select using (
    exists (
      select 1 from pack_members
      where pack_id = faq_entries.pack_id and user_id = auth.uid()
    )
  );

-- Authors and above can insert/update/delete
create policy "faq_entries_write" on faq_entries
  for all using (
    exists (
      select 1 from pack_members
      where pack_id = faq_entries.pack_id
        and user_id = auth.uid()
        and access_level in ('author','admin','owner')
    )
  );

-- Auto-update updated_at
create or replace function update_faq_entries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger faq_entries_updated_at
  before update on faq_entries
  for each row execute function update_faq_entries_updated_at();

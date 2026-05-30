-- Manual glossary terms (author-curated, layered on top of AI-generated glossary)
create table if not exists manual_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  term text not null,
  definition text not null,
  context text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  source text default 'manual' check (source in ('manual','faq','chat'))
);

alter table manual_glossary_terms enable row level security;

-- All pack members can read
create policy "manual_glossary_read" on manual_glossary_terms
  for select using (
    exists (
      select 1 from pack_members
      where pack_id = manual_glossary_terms.pack_id and user_id = auth.uid()
    )
  );

-- Authors and above can write
create policy "manual_glossary_write" on manual_glossary_terms
  for all using (
    exists (
      select 1 from pack_members
      where pack_id = manual_glossary_terms.pack_id
        and user_id = auth.uid()
        and access_level in ('author','admin','owner')
    )
  );

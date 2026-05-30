-- Enable trigram extension for similarity search (safe if already exists)
create extension if not exists pg_trgm;

-- FAQ Suggestions table (tracks repeated questions)
create table if not exists faq_suggestions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  canonical_question text not null,
  example_questions text[] default '{}',
  count integer default 1,
  last_seen_at timestamptz default now(),
  status text default 'open' check (status in ('open','dismissed','converted')),
  converted_to_faq_id uuid references faq_entries(id)
);

alter table faq_suggestions enable row level security;

-- Authors and above can read/write suggestions
create policy "faq_suggestions_author" on faq_suggestions
  for all using (
    exists (
      select 1 from pack_members
      where pack_id = faq_suggestions.pack_id
        and user_id = auth.uid()
        and access_level in ('author','admin','owner')
    )
  );

-- RPC: upsert a FAQ suggestion using trigram similarity
-- Called every time a user sends a chat message or creates a question thread.
create or replace function upsert_faq_suggestion(
  p_pack_id uuid,
  p_question text
) returns void language plpgsql security definer as $$
declare
  normalized text;
  match_id uuid;
begin
  -- Normalize: lowercase, strip non-alphanumeric (except spaces), collapse whitespace
  normalized := lower(regexp_replace(p_question, '[^a-z0-9 ]', '', 'g'));
  normalized := trim(regexp_replace(normalized, '\s+', ' ', 'g'));

  -- Skip very short strings
  if length(normalized) < 5 then return; end if;

  -- Find existing open suggestion with >40% trigram similarity
  select id into match_id
  from faq_suggestions
  where pack_id = p_pack_id
    and status = 'open'
    and similarity(canonical_question, normalized) > 0.4
  order by similarity(canonical_question, normalized) desc
  limit 1;

  if match_id is not null then
    -- Increment count; cap example_questions at 10
    update faq_suggestions
    set count = count + 1,
        last_seen_at = now(),
        example_questions = case
          when array_length(example_questions, 1) >= 10 then example_questions
          else array_append(example_questions, p_question)
        end
    where id = match_id;
  else
    -- Create new suggestion
    insert into faq_suggestions (pack_id, canonical_question, example_questions)
    values (p_pack_id, normalized, array[p_question]);
  end if;
end;
$$;

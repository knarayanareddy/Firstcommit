-- Stubs for missing tables to allow historical migrations to pass
CREATE TABLE IF NOT EXISTS public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid);
CREATE TABLE IF NOT EXISTS public.learner_badges (id uuid primary key default gen_random_uuid(), user_id uuid, pack_id uuid);
CREATE TABLE IF NOT EXISTS public.playlist_items (id uuid primary key default gen_random_uuid(), item_type text, playlist_id uuid, pack_id uuid, title text, description text, required boolean default true, sort_order int, module_id uuid, section_id text, due_offset_days int, unlock_offset_days int);
CREATE TABLE IF NOT EXISTS public.learner_xp (id uuid primary key default gen_random_uuid(), user_id uuid, pack_id uuid);

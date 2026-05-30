-- Migration: Add 'doc' to playlist_items item_type
ALTER TABLE public.playlist_items DROP CONSTRAINT IF EXISTS playlist_items_type_check;
ALTER TABLE public.playlist_items ADD CONSTRAINT playlist_items_type_check CHECK (item_type IN ('module', 'section', 'quiz', 'milestone', 'task', 'link', 'doc'));

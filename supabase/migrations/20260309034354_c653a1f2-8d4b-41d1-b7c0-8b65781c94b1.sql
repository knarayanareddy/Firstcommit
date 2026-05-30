
-- Create bookmark_collections table
CREATE TABLE public.bookmark_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '📁',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pack_id, name)
);

ALTER TABLE public.bookmark_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collections" ON public.bookmark_collections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Expand bookmarks table with new columns
ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS preview_text text,
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.bookmark_collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Update the bookmark_type validation trigger to support new types
CREATE OR REPLACE FUNCTION public.validate_bookmark_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bookmark_type NOT IN ('module_section', 'glossary_term', 'path_step', 'ask_lead_question', 'exercise', 'code_snippet', 'chat_message', 'custom') THEN
    RAISE EXCEPTION 'Invalid bookmark_type: %', NEW.bookmark_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger if not exists (drop first to be safe)
DROP TRIGGER IF EXISTS trg_validate_bookmark_type ON public.bookmarks;
CREATE TRIGGER trg_validate_bookmark_type
  BEFORE INSERT OR UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.validate_bookmark_type();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_pack_collection ON public.bookmarks(user_id, pack_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_collections_user_pack ON public.bookmark_collections(user_id, pack_id);

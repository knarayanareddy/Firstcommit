
-- Task 4: Bookmarks

CREATE TABLE public.bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  bookmark_type text NOT NULL,
  reference_key text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_id, bookmark_type, reference_key)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_bookmark_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.bookmark_type NOT IN ('module_section', 'glossary_term', 'path_step', 'ask_lead_question') THEN
    RAISE EXCEPTION 'Invalid bookmark_type: %', NEW.bookmark_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_bookmark_type
  BEFORE INSERT OR UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.validate_bookmark_type();

CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

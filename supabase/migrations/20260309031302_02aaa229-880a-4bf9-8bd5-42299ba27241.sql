
-- Task 6: Spaced Repetition & Knowledge Checks
CREATE TABLE public.review_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  next_review_date date NOT NULL DEFAULT CURRENT_DATE + 3,
  review_count integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamp with time zone,
  UNIQUE(user_id, pack_id, module_key)
);
ALTER TABLE public.review_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own review schedule" ON public.review_schedule FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.knowledge_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  check_type text NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  questions_data jsonb DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_checks ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_check_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.check_type NOT IN ('pre_test', 'review') THEN
    RAISE EXCEPTION 'Invalid check_type: %', NEW.check_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_check_type BEFORE INSERT OR UPDATE ON public.knowledge_checks FOR EACH ROW EXECUTE FUNCTION public.validate_check_type();
CREATE POLICY "Users manage own knowledge checks" ON public.knowledge_checks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Task 7: Content Freshness
CREATE TABLE public.content_freshness (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  section_id text NOT NULL,
  referenced_chunk_ids text[] DEFAULT '{}',
  chunk_hash_at_generation jsonb DEFAULT '{}',
  chunks_snapshot jsonb DEFAULT '{}',
  is_stale boolean NOT NULL DEFAULT false,
  staleness_details jsonb DEFAULT '{}',
  last_checked_at timestamp with time zone DEFAULT now(),
  UNIQUE(pack_id, module_key, section_id)
);
ALTER TABLE public.content_freshness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authors can read content freshness" ON public.content_freshness FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can insert content freshness" ON public.content_freshness FOR INSERT WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can update content freshness" ON public.content_freshness FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can delete content freshness" ON public.content_freshness FOR DELETE USING (has_pack_access(auth.uid(), pack_id, 'author'));

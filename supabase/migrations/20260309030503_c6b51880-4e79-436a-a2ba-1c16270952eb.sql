
-- Task 2: Content Feedback & Rating System

-- content_feedback table
CREATE TABLE public.content_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  section_id text,
  feedback_type text NOT NULL,
  comment text,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_content_feedback_unique ON public.content_feedback (user_id, pack_id, module_key, COALESCE(section_id, '__null__'), feedback_type);
CREATE INDEX idx_content_feedback_pack ON public.content_feedback (pack_id, module_key, is_resolved);

ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;

-- Validation trigger for feedback_type
CREATE OR REPLACE FUNCTION public.validate_feedback_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.feedback_type NOT IN ('thumbs_up', 'thumbs_down', 'confusing', 'outdated', 'incorrect', 'missing_context') THEN
    RAISE EXCEPTION 'Invalid feedback_type: %', NEW.feedback_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_feedback_type
  BEFORE INSERT OR UPDATE ON public.content_feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_feedback_type();

-- RLS: users manage own rows
CREATE POLICY "Users can insert own feedback" ON public.content_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON public.content_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON public.content_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feedback" ON public.content_feedback FOR DELETE USING (auth.uid() = user_id);
-- Authors+ can read all pack feedback
CREATE POLICY "Authors can view pack feedback" ON public.content_feedback FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'author'));
-- Authors+ can resolve feedback
CREATE POLICY "Authors can resolve feedback" ON public.content_feedback FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- content_ratings table
CREATE TABLE public.content_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  section_id text,
  rating integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_content_ratings_unique ON public.content_ratings (user_id, pack_id, module_key, COALESCE(section_id, '__null__'));

ALTER TABLE public.content_ratings ENABLE ROW LEVEL SECURITY;

-- Validation trigger for rating
CREATE OR REPLACE FUNCTION public.validate_content_rating()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5: %', NEW.rating;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_content_rating
  BEFORE INSERT OR UPDATE ON public.content_ratings
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_rating();

-- RLS
CREATE POLICY "Users can insert own ratings" ON public.content_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own ratings" ON public.content_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON public.content_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON public.content_ratings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Authors can view pack ratings" ON public.content_ratings FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'author'));

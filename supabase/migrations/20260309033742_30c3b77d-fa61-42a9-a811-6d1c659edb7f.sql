
-- Exercises table
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  module_key text NOT NULL,
  section_id text,
  exercise_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  exercise_type text NOT NULL,
  difficulty text DEFAULT 'intermediate',
  estimated_minutes integer DEFAULT 10,
  hints jsonb DEFAULT '[]'::jsonb,
  verification jsonb DEFAULT '{}'::jsonb,
  evidence_citations jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pack_id, module_key, exercise_key)
);

-- Validation trigger for exercise_type
CREATE OR REPLACE FUNCTION public.validate_exercise_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.exercise_type NOT IN ('code_find', 'code_explain', 'config_task', 'debug_challenge', 'explore_and_answer', 'terminal_task', 'free_response') THEN
    RAISE EXCEPTION 'Invalid exercise_type: %', NEW.exercise_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_exercise_type
BEFORE INSERT OR UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.validate_exercise_type();

-- Validation trigger for exercise difficulty
CREATE OR REPLACE FUNCTION public.validate_exercise_difficulty()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.difficulty IS NOT NULL AND NEW.difficulty NOT IN ('beginner', 'intermediate', 'advanced') THEN
    RAISE EXCEPTION 'Invalid exercise difficulty: %', NEW.difficulty;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_exercise_difficulty
BEFORE INSERT OR UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.validate_exercise_difficulty();

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read exercises" ON public.exercises
  FOR SELECT USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert exercises" ON public.exercises
  FOR INSERT WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update exercises" ON public.exercises
  FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete exercises" ON public.exercises
  FOR DELETE USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- Exercise submissions table
CREATE TABLE public.exercise_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  exercise_key text NOT NULL,
  submission_type text NOT NULL,
  content text NOT NULL,
  ai_feedback jsonb,
  status text DEFAULT 'submitted',
  hints_used integer DEFAULT 0,
  time_spent_seconds integer,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pack_id, exercise_key)
);

-- Validation trigger for submission_type
CREATE OR REPLACE FUNCTION public.validate_submission_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.submission_type NOT IN ('text', 'code', 'file_path', 'terminal_output', 'screenshot_description') THEN
    RAISE EXCEPTION 'Invalid submission_type: %', NEW.submission_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_submission_type
BEFORE INSERT OR UPDATE ON public.exercise_submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_submission_type();

-- Validation trigger for submission status
CREATE OR REPLACE FUNCTION public.validate_submission_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('submitted', 'verified', 'needs_revision') THEN
    RAISE EXCEPTION 'Invalid submission status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_submission_status
BEFORE INSERT OR UPDATE ON public.exercise_submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_submission_status();

ALTER TABLE public.exercise_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own submissions" ON public.exercise_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own submissions" ON public.exercise_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions" ON public.exercise_submissions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authors can read all submissions" ON public.exercise_submissions
  FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE INDEX idx_exercises_pack_module ON public.exercises(pack_id, module_key);
CREATE INDEX idx_exercise_submissions_pack ON public.exercise_submissions(pack_id, exercise_key);

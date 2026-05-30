
-- quiz_attempts: per-question granular data
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  module_key text NOT NULL,
  question_id text NOT NULL,
  selected_choice_id text NOT NULL,
  is_correct boolean NOT NULL,
  time_spent_seconds integer,
  attempt_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_pack_module_question ON public.quiz_attempts (pack_id, module_key, question_id);
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts (user_id, pack_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own quiz attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authors can read pack quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- quiz_question_feedback: per-question feedback from learners
CREATE TABLE public.quiz_question_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  module_key text NOT NULL,
  question_id text NOT NULL,
  feedback_type text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_id, module_key, question_id, feedback_type)
);

ALTER TABLE public.quiz_question_feedback ENABLE ROW LEVEL SECURITY;

-- Validation trigger for feedback_type
CREATE OR REPLACE FUNCTION public.validate_quiz_question_feedback_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.feedback_type NOT IN ('fair', 'unfair', 'confusing', 'too_easy', 'too_hard', 'ambiguous', 'incorrect_answer') THEN
    RAISE EXCEPTION 'Invalid quiz question feedback_type: %', NEW.feedback_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_quiz_question_feedback_type
  BEFORE INSERT OR UPDATE ON public.quiz_question_feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_quiz_question_feedback_type();

CREATE POLICY "Users can insert own quiz feedback" ON public.quiz_question_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own quiz feedback" ON public.quiz_question_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authors can read pack quiz feedback" ON public.quiz_question_feedback
  FOR SELECT TO authenticated USING (has_pack_access(auth.uid(), pack_id, 'author'));

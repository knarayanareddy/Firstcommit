
CREATE TABLE public.generated_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  module_key text NOT NULL,
  quiz_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, module_key)
);

ALTER TABLE public.generated_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generated quizzes"
  ON public.generated_quizzes FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generated quizzes"
  ON public.generated_quizzes FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Authors can update generated quizzes"
  ON public.generated_quizzes FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Admins can delete generated quizzes"
  ON public.generated_quizzes FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'::text));

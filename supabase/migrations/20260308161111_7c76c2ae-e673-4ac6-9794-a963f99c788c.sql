
CREATE TABLE public.generated_ask_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  questions_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_ask_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generated ask lead"
  ON public.generated_ask_lead FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generated ask lead"
  ON public.generated_ask_lead FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Authors can update generated ask lead"
  ON public.generated_ask_lead FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Admins can delete generated ask lead"
  ON public.generated_ask_lead FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'::text));

CREATE TABLE public.ask_lead_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  question_id text NOT NULL,
  is_asked boolean NOT NULL DEFAULT false,
  asked_at timestamptz,
  UNIQUE(user_id, pack_id, question_id)
);

ALTER TABLE public.ask_lead_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ask lead progress"
  ON public.ask_lead_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ask lead progress"
  ON public.ask_lead_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ask lead progress"
  ON public.ask_lead_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ask lead progress"
  ON public.ask_lead_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

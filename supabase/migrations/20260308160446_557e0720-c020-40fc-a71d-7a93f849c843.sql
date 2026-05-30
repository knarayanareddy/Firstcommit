
CREATE TABLE public.generated_glossaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  glossary_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  glossary_density text DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_glossaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generated glossaries"
  ON public.generated_glossaries FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generated glossaries"
  ON public.generated_glossaries FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Authors can update generated glossaries"
  ON public.generated_glossaries FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Admins can delete generated glossaries"
  ON public.generated_glossaries FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'::text));

-- Add glossary_density column to audience_preferences
ALTER TABLE public.audience_preferences ADD COLUMN IF NOT EXISTS glossary_density text NOT NULL DEFAULT 'standard';

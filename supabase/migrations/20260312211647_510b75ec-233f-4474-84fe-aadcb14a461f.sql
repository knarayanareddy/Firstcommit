
CREATE TABLE IF NOT EXISTS public.chat_transcripts_flagged (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.chat_feedback(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  pathname TEXT,
  pack_id UUID REFERENCES public.packs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_transcripts_flagged ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read flagged transcripts"
ON public.chat_transcripts_flagged FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pack_members pm
    WHERE pm.pack_id = chat_transcripts_flagged.pack_id
    AND pm.user_id = auth.uid()
    AND pm.access_level IN ('author', 'admin')
  )
);

CREATE POLICY "Users can insert flagged transcripts"
ON public.chat_transcripts_flagged FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_feedback cf
    WHERE cf.id = chat_transcripts_flagged.feedback_id
    AND cf.user_id = auth.uid()
  )
);

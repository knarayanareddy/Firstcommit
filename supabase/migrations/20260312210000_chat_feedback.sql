-- Chat feedback table for "Report incorrect answer" flow
CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE,
  module_id text,
  message_content text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('incorrect','outdated','confusing','missing_citations','policy_violation')),
  comment text,
  create_task boolean DEFAULT true,
  is_resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own chat feedback' AND tablename = 'chat_feedback') THEN
    CREATE POLICY "Users can insert own chat feedback"
      ON public.chat_feedback FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own chat feedback' AND tablename = 'chat_feedback') THEN
    CREATE POLICY "Users can read own chat feedback"
      ON public.chat_feedback FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authors can read pack chat feedback' AND tablename = 'chat_feedback') THEN
    CREATE POLICY "Authors can read pack chat feedback"
      ON public.chat_feedback FOR SELECT
      TO authenticated
      USING (
        pack_id IS NULL OR
        EXISTS (
          SELECT 1 FROM public.pack_members pm
          WHERE pm.pack_id = chat_feedback.pack_id
            AND pm.user_id = auth.uid()
            AND pm.access_level IN ('author', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authors can resolve chat feedback' AND tablename = 'chat_feedback') THEN
    CREATE POLICY "Authors can resolve chat feedback"
      ON public.chat_feedback FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.pack_members pm
          WHERE pm.pack_id = chat_feedback.pack_id
            AND pm.user_id = auth.uid()
            AND pm.access_level IN ('author', 'admin')
        )
      );
  END IF;
END $$;

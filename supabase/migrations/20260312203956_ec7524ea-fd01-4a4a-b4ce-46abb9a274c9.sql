
-- Create chat_feedback table
CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE,
  module_id text,
  message_content text NOT NULL,
  reason text NOT NULL,
  comment text,
  create_task boolean DEFAULT true,
  is_resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Validation trigger for reason
CREATE OR REPLACE FUNCTION public.validate_chat_feedback_reason()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reason NOT IN ('incorrect','outdated','confusing','missing_citations','policy_violation') THEN
    RAISE EXCEPTION 'Invalid chat feedback reason: %', NEW.reason;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_chat_feedback_reason
  BEFORE INSERT OR UPDATE ON public.chat_feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_feedback_reason();

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own chat feedback"
  ON public.chat_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own chat feedback"
  ON public.chat_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authors can read pack chat feedback"
  ON public.chat_feedback FOR SELECT
  TO authenticated
  USING (
    pack_id IS NOT NULL AND has_pack_access(auth.uid(), pack_id, 'author'::text)
  );

CREATE POLICY "Authors can resolve chat feedback"
  ON public.chat_feedback FOR UPDATE
  TO authenticated
  USING (
    has_pack_access(auth.uid(), pack_id, 'author'::text)
  );

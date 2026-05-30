
-- Add generation prefs columns to audience_preferences
ALTER TABLE public.audience_preferences
  ADD COLUMN IF NOT EXISTS target_reading_level text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS max_sections_hint integer NOT NULL DEFAULT 7;

-- Create pack-level generation limits table
CREATE TABLE public.pack_generation_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  max_module_words integer NOT NULL DEFAULT 1400,
  max_quiz_questions integer NOT NULL DEFAULT 5,
  max_key_takeaways integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(pack_id)
);

ALTER TABLE public.pack_generation_limits ENABLE ROW LEVEL SECURITY;

-- Validation trigger for target_reading_level
CREATE OR REPLACE FUNCTION public.validate_target_reading_level()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.target_reading_level NOT IN ('plain', 'standard', 'technical') THEN
    RAISE EXCEPTION 'Invalid target_reading_level: %', NEW.target_reading_level;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_target_reading_level
  BEFORE INSERT OR UPDATE ON public.audience_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_target_reading_level();

-- Validation trigger for max_sections_hint (1-15)
CREATE OR REPLACE FUNCTION public.validate_max_sections_hint()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.max_sections_hint < 1 OR NEW.max_sections_hint > 15 THEN
    RAISE EXCEPTION 'max_sections_hint must be between 1 and 15: %', NEW.max_sections_hint;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_max_sections_hint
  BEFORE INSERT OR UPDATE ON public.audience_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_max_sections_hint();

-- RLS for pack_generation_limits
CREATE POLICY "Pack members can read generation limits"
  ON public.pack_generation_limits FOR SELECT
  TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generation limits"
  ON public.pack_generation_limits FOR INSERT
  TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update generation limits"
  ON public.pack_generation_limits FOR UPDATE
  TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

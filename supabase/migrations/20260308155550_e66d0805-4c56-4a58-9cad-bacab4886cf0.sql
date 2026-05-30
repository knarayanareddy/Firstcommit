
-- Create generated_modules table
CREATE TABLE public.generated_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  module_revision integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  estimated_minutes integer,
  difficulty text,
  track_key text,
  audience text,
  depth text,
  module_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, module_key, module_revision)
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_generated_module_difficulty()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.difficulty IS NOT NULL AND NEW.difficulty NOT IN ('beginner', 'intermediate', 'advanced') THEN
    RAISE EXCEPTION 'Invalid difficulty: %', NEW.difficulty;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_generated_module_difficulty
  BEFORE INSERT OR UPDATE ON public.generated_modules
  FOR EACH ROW EXECUTE FUNCTION public.validate_generated_module_difficulty();

CREATE OR REPLACE FUNCTION public.validate_generated_module_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid generated_module status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_generated_module_status
  BEFORE INSERT OR UPDATE ON public.generated_modules
  FOR EACH ROW EXECUTE FUNCTION public.validate_generated_module_status();

-- Updated_at trigger
CREATE TRIGGER trg_generated_modules_updated_at
  BEFORE UPDATE ON public.generated_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_generated_modules_pack_id ON public.generated_modules(pack_id);
CREATE INDEX idx_generated_modules_pack_module ON public.generated_modules(pack_id, module_key);

-- RLS
ALTER TABLE public.generated_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generated modules"
  ON public.generated_modules FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generated modules"
  ON public.generated_modules FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update generated modules"
  ON public.generated_modules FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Admins can delete generated modules"
  ON public.generated_modules FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

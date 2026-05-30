
-- Validation trigger for requirement_type
CREATE OR REPLACE FUNCTION public.validate_dependency_requirement_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.requirement_type NOT IN ('hard', 'soft') THEN
    RAISE EXCEPTION 'Invalid requirement_type: %', NEW.requirement_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- Validation trigger for min_completion_percentage
CREATE OR REPLACE FUNCTION public.validate_dependency_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.min_completion_percentage < 0 OR NEW.min_completion_percentage > 100 THEN
    RAISE EXCEPTION 'min_completion_percentage must be 0-100: %', NEW.min_completion_percentage;
  END IF;
  IF NEW.min_quiz_score < 0 OR NEW.min_quiz_score > 100 THEN
    RAISE EXCEPTION 'min_quiz_score must be 0-100: %', NEW.min_quiz_score;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create table
CREATE TABLE public.module_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  requires_module_key text NOT NULL,
  requirement_type text NOT NULL DEFAULT 'soft',
  min_completion_percentage integer NOT NULL DEFAULT 100,
  min_quiz_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, module_key, requires_module_key)
);

-- Triggers
CREATE TRIGGER trg_validate_dependency_type
  BEFORE INSERT OR UPDATE ON public.module_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.validate_dependency_requirement_type();

CREATE TRIGGER trg_validate_dependency_completion
  BEFORE INSERT OR UPDATE ON public.module_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.validate_dependency_completion();

-- Indexes
CREATE INDEX idx_module_deps_pack ON public.module_dependencies(pack_id);
CREATE INDEX idx_module_deps_module ON public.module_dependencies(pack_id, module_key);

-- RLS
ALTER TABLE public.module_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read dependencies"
  ON public.module_dependencies FOR SELECT
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert dependencies"
  ON public.module_dependencies FOR INSERT
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update dependencies"
  ON public.module_dependencies FOR UPDATE
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete dependencies"
  ON public.module_dependencies FOR DELETE
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

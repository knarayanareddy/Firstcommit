
-- Create module_plans table
CREATE TABLE public.module_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  pack_version integer NOT NULL,
  plan_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_module_plan_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'approved', 'generating', 'completed') THEN
    RAISE EXCEPTION 'Invalid module_plan status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_module_plan_status
  BEFORE INSERT OR UPDATE ON public.module_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_module_plan_status();

-- Indexes
CREATE INDEX idx_module_plans_pack_id ON public.module_plans(pack_id);

-- RLS
ALTER TABLE public.module_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read module plans"
  ON public.module_plans FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert module plans"
  ON public.module_plans FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update module plans"
  ON public.module_plans FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Admins can delete module plans"
  ON public.module_plans FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

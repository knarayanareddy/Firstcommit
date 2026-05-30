
CREATE TABLE public.module_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  title text NOT NULL,
  description text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, template_key)
);

ALTER TABLE public.module_templates ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read templates
CREATE POLICY "Org members can read templates"
  ON public.module_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = module_templates.org_id
    AND org_members.user_id = auth.uid()
  ));

-- RLS: org admins can insert templates
CREATE POLICY "Org admins can insert templates"
  ON public.module_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = module_templates.org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  ));

-- RLS: org admins can update templates
CREATE POLICY "Org admins can update templates"
  ON public.module_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = module_templates.org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  ));

-- RLS: org admins can delete templates
CREATE POLICY "Org admins can delete templates"
  ON public.module_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = module_templates.org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  ));

-- Updated_at trigger
CREATE TRIGGER update_module_templates_updated_at
  BEFORE UPDATE ON public.module_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

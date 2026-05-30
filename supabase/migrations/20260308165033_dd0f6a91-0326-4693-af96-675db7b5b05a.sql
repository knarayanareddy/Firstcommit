ALTER TABLE public.audience_preferences 
  ADD COLUMN IF NOT EXISTS mermaid_enabled boolean NOT NULL DEFAULT true;
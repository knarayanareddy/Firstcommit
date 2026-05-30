-- YYYYMMDDHHMMSS_roadmap_feature_flag.sql

-- Add roadmap_enabled flag to packs
ALTER TABLE public.packs 
ADD COLUMN IF NOT EXISTS roadmap_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.packs.roadmap_enabled IS 'Feature flag to enable/disable the Structured Roadmap feature for a specific pack.';

-- RLS should already allow members to read packs
-- Ensure authors/admins can update it
-- (Assuming standard RLS on packs: update allowed for owners/admins)

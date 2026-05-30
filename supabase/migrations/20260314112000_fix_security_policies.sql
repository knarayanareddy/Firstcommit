-- Migration to fix security vulnerabilities in RLS policies
-- Created: 2026-03-14

-- 1. Secure module_remediations table
-- Add pack_id to module_remediations to enable granular access control
ALTER TABLE public.module_remediations ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;

-- Drop all existing permissive or conflicting policies on module_remediations
DROP POLICY IF EXISTS "Authenticated users can read remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Service role can insert remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Authenticated users can update remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Enable full access for authors to remediations" ON public.module_remediations;

-- Create new restrictive policy: only authors and above can manage remediations for their packs
CREATE POLICY "Authors can manage remediations"
  ON public.module_remediations FOR ALL
  TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'))
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'author'));


-- 2. Fix pack_members vulnerability
-- Remove the policy that allowed any user to grant themselves membership to any pack
DROP POLICY IF EXISTS "Users can insert own pack membership" ON public.pack_members;


-- 3. Fix org_members vulnerability
-- Remove the policy that allowed any user to grant themselves membership to any organization
DROP POLICY IF EXISTS "Authenticated users can insert own org membership" ON public.org_members;


-- 4. Secure organizations table
-- Remove the policy that allowed any authenticated user to create organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

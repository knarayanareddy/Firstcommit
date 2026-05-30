
-- 1. Create server-side RPC for awarding XP (SECURITY DEFINER, only callable by authenticated but validated server-side)
CREATE OR REPLACE FUNCTION public.award_xp_server(
  p_user_id uuid,
  p_pack_id uuid,
  p_amount integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is the same user (prevents awarding XP to others)
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot award XP to another user';
  END IF;
  
  -- Verify pack membership
  IF NOT is_pack_member(p_user_id, p_pack_id) THEN
    RAISE EXCEPTION 'User is not a member of this pack';
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 OR p_amount > 100 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  INSERT INTO public.learner_xp (user_id, pack_id, amount, reason)
  VALUES (p_user_id, p_pack_id, p_amount, p_reason);
END;
$$;

-- Revoke public execute, grant only to authenticated
REVOKE ALL ON FUNCTION public.award_xp_server(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_xp_server(uuid, uuid, integer, text) TO authenticated;

-- 2. Create server-side RPC for awarding badges (idempotent)
CREATE OR REPLACE FUNCTION public.award_badge_server(
  p_user_id uuid,
  p_pack_id uuid,
  p_badge_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is the same user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot award badge to another user';
  END IF;
  
  -- Verify pack membership
  IF NOT is_pack_member(p_user_id, p_pack_id) THEN
    RAISE EXCEPTION 'User is not a member of this pack';
  END IF;

  -- Idempotent: skip if already earned
  IF EXISTS (
    SELECT 1 FROM public.learner_badges
    WHERE user_id = p_user_id AND pack_id = p_pack_id AND badge_key = p_badge_key
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.learner_badges (user_id, pack_id, badge_key)
  VALUES (p_user_id, p_pack_id, p_badge_key);
  
  RETURN true;
END;
$$;

-- Revoke public execute, grant only to authenticated
REVOKE ALL ON FUNCTION public.award_badge_server(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_badge_server(uuid, uuid, text) TO authenticated;

-- 3. Remove direct client INSERT policies on learner_xp and learner_badges
DROP POLICY IF EXISTS "Users can insert their own XP" ON public.learner_xp;
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.learner_badges;

-- 4. Add storage UPDATE policy for source-files bucket
CREATE POLICY "Authors can update source files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'source-files'
  AND (storage.foldername(name))[1] IN (
    SELECT pm.pack_id::text
    FROM pack_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.access_level = ANY (ARRAY['author'::text, 'admin'::text, 'owner'::text])
  )
)
WITH CHECK (
  bucket_id = 'source-files'
  AND (storage.foldername(name))[1] IN (
    SELECT pm.pack_id::text
    FROM pack_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.access_level = ANY (ARRAY['author'::text, 'admin'::text, 'owner'::text])
  )
);

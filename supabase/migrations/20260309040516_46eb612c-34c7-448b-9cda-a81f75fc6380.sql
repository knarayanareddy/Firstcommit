
-- Allow authenticated users to insert notifications for peer features (replies, accepted answers, etc.)
DO $$
BEGIN
  -- Only attempt to create the policy if the table actually exists.
  -- (Currently, this table appears to be missing from the migration sequence)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'Authenticated users can insert peer notifications'
    ) THEN
      CREATE POLICY "Authenticated users can insert peer notifications"
      ON public.notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
    END IF;
  END IF;
END $$;

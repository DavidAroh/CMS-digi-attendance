-- Create public signatures bucket for storing student signature images
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('signatures', 'signatures', true);
EXCEPTION WHEN unique_violation THEN NULL; END $$;

-- Allow public read for signatures bucket
DO $$ BEGIN
  CREATE POLICY "Public read signatures"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'signatures');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow authenticated users to insert into signatures bucket
DO $$ BEGIN
  CREATE POLICY "Auth insert signatures"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'signatures');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow owners to update/delete their own signature objects
DO $$ BEGIN
  CREATE POLICY "Owner update signatures"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'signatures' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'signatures' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner delete signatures"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'signatures' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
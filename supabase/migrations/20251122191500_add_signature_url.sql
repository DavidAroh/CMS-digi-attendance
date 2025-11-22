-- Add signature_url column to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature_url text;

-- Optional index for faster lookups/exports
CREATE INDEX IF NOT EXISTS idx_profiles_signature ON profiles(signature_url);
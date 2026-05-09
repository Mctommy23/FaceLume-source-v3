-- Add account-based activation fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_key text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_license_key_unique
  ON public.profiles (license_key)
  WHERE license_key IS NOT NULL;
-- Activations table: one record per device a user activates
CREATE TABLE public.activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  access_key TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activations_device_id_unique UNIQUE (device_id),
  CONSTRAINT activations_access_key_unique UNIQUE (access_key)
);

CREATE INDEX idx_activations_user_id ON public.activations(user_id);

ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activations"
  ON public.activations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activations"
  ON public.activations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activations"
  ON public.activations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_activations_updated_at
  BEFORE UPDATE ON public.activations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
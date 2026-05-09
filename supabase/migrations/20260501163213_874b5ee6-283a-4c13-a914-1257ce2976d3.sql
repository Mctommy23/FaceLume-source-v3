CREATE TABLE IF NOT EXISTS public.activation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  credits_granted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activation_orders_user_id_idx
  ON public.activation_orders (user_id);

ALTER TABLE public.activation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activation orders"
  ON public.activation_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
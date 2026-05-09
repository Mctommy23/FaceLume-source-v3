-- Track every credit top-up so the webhook can credit idempotently.
CREATE TABLE public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL,
  amount_usd integer NOT NULL,
  credits integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX idx_credit_purchases_user ON public.credit_purchases(user_id);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
ON public.credit_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pending purchases"
ON public.credit_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

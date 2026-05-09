
CREATE TABLE public.atlos_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  order_id text,
  status text,
  signature_valid boolean NOT NULL DEFAULT false,
  signature_header text,
  response_code integer,
  error_message text,
  payload jsonb,
  source_ip text
);

CREATE INDEX atlos_webhook_logs_received_at_idx
  ON public.atlos_webhook_logs (received_at DESC);
CREATE INDEX atlos_webhook_logs_order_id_idx
  ON public.atlos_webhook_logs (order_id);

ALTER TABLE public.atlos_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
  ON public.atlos_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

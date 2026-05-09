-- Replace the broad self-update policy on activations: users must not be
-- able to flip `paid`, `paid_at`, or rotate `access_key` on their own row.
-- Those fields are only set server-side by the atlos-webhook (service role).
DROP POLICY IF EXISTS "Users can update their own activations" ON public.activations;

CREATE POLICY "Users can update their own activations (safe fields)"
ON public.activations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND paid = (SELECT paid FROM public.activations WHERE id = activations.id)
  AND paid_at IS NOT DISTINCT FROM (SELECT paid_at FROM public.activations WHERE id = activations.id)
  AND access_key = (SELECT access_key FROM public.activations WHERE id = activations.id)
  AND user_id = (SELECT user_id FROM public.activations WHERE id = activations.id)
);
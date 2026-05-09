-- Revert to a simpler self-update policy and enforce the field lockdown
-- via a BEFORE UPDATE trigger (same pattern used for profiles). RLS WITH
-- CHECK subqueries on the same table are unreliable due to aliasing.
DROP POLICY IF EXISTS "Users can update their own activations (safe fields)" ON public.activations;

CREATE POLICY "Users can update their own activations"
ON public.activations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prevent_activation_payment_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and admins bypass.
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.paid IS DISTINCT FROM OLD.paid
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.access_key IS DISTINCT FROM OLD.access_key
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify payment fields on activations';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_activation_payment_tampering_trg ON public.activations;
CREATE TRIGGER prevent_activation_payment_tampering_trg
BEFORE UPDATE ON public.activations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_activation_payment_tampering();
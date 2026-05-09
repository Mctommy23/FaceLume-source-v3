CREATE OR REPLACE FUNCTION public.validate_credit_purchase_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok BOOLEAN := FALSE;
BEGIN
  -- Backend (service role / no auth) and admins bypass.
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Server-side allow list. Keep in sync with src/lib/creditPlans.ts.
  ok := (
    (NEW.plan = 'starter' AND NEW.credits = 1200  AND NEW.amount_usd = 20)
 OR (NEW.plan = 'pro'     AND NEW.credits = 3000  AND NEW.amount_usd = 45)
 OR (NEW.plan = 'premium' AND NEW.credits = 4800  AND NEW.amount_usd = 70)
 OR (NEW.plan = 'elite'   AND NEW.credits = 14400 AND NEW.amount_usd = 220)
  );

  IF NOT ok THEN
    RAISE EXCEPTION 'Invalid credit purchase: (plan=%, credits=%, amount_usd=%) does not match any allowed plan',
      NEW.plan, NEW.credits, NEW.amount_usd;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_credit_purchase_plan_trg ON public.credit_purchases;
CREATE TRIGGER validate_credit_purchase_plan_trg
BEFORE INSERT OR UPDATE ON public.credit_purchases
FOR EACH ROW EXECUTE FUNCTION public.validate_credit_purchase_plan();
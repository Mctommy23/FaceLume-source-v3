-- 1. Unique constraint on order_id (partial: NULLs allowed for not-yet-submitted rows)
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_order_id_key
  ON public.credit_purchases (order_id)
  WHERE order_id IS NOT NULL;

-- 2. Status allow-list + transition validation
CREATE OR REPLACE FUNCTION public.validate_credit_purchase_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always validate status value itself (for both INSERT and UPDATE)
  IF NEW.status NOT IN ('pending', 'paid', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid credit_purchase status: %', NEW.status;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- New rows must start as pending
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'New credit_purchase must start with status=pending (got %)', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Backend (service role) and admins can perform recoveries (e.g. paid->pending rollback).
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin transitions: only from pending to a terminal state.
  IF OLD.status = 'pending' AND NEW.status IN ('paid', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Disallowed credit_purchase status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS validate_credit_purchase_status_trg ON public.credit_purchases;
CREATE TRIGGER validate_credit_purchase_status_trg
BEFORE INSERT OR UPDATE ON public.credit_purchases
FOR EACH ROW EXECUTE FUNCTION public.validate_credit_purchase_status();
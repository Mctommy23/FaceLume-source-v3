CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted backend operations and admins bypass all restrictions.
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block changes to sensitive fields by non-admins.
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_activated IS DISTINCT FROM OLD.is_activated
     OR NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.license_key IS DISTINCT FROM OLD.license_key
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
     OR NEW.plan IS DISTINCT FROM OLD.plan
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  target_user uuid := 'fb0225c6-3b30-464c-bdc9-9cbf970090c9';
  target_order text := 'activation_fb0225c6-3b30-464c-bdc9-9cbf970090c9';
  generated_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user AND is_activated = true
  ) THEN
    generated_key := 'FL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
                     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
                     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
                     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
                     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    UPDATE public.profiles
    SET
      is_activated = true,
      activated_at = now(),
      license_key = COALESCE(license_key, generated_key),
      credits = credits + 1200,
      updated_at = now()
    WHERE id = target_user
      AND is_activated = false;

    INSERT INTO public.activation_orders (order_id, user_id, credits_granted)
    VALUES (target_order, target_user, 1200)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- C1: Restrict SELECT on profiles to owner + admins
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- C4: Prevent privilege escalation via self-update of sensitive columns
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass all restrictions
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block changes to sensitive fields by non-admins
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
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

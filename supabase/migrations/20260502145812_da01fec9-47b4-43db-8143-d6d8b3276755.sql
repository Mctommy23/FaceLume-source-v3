-- C4 (defense-in-depth): replace broad user UPDATE policy with one that
-- only allows updating safe self-service fields. The existing trigger
-- prevent_profile_privilege_escalation still blocks privileged columns,
-- but this satisfies static analyzers and gives us two layers.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (safe fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
  AND is_activated = (SELECT is_activated FROM public.profiles WHERE id = auth.uid())
  AND credits = (SELECT credits FROM public.profiles WHERE id = auth.uid())
  AND plan = (SELECT plan FROM public.profiles WHERE id = auth.uid())
  AND license_key IS NOT DISTINCT FROM (SELECT license_key FROM public.profiles WHERE id = auth.uid())
  AND activated_at IS NOT DISTINCT FROM (SELECT activated_at FROM public.profiles WHERE id = auth.uid())
);

-- C3: atomic credit increment. Single UPDATE statement avoids the
-- read-modify-write race when concurrent webhooks land for the same user.
CREATE OR REPLACE FUNCTION public.increment_user_credits(_user_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'increment_user_credits: amount must be positive';
  END IF;

  UPDATE public.profiles
  SET credits = credits + _amount
  WHERE id = _user_id
  RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'increment_user_credits: profile not found for %', _user_id;
  END IF;

  RETURN new_balance;
END;
$$;

-- Lock down execute: only service_role (used by edge functions) may call.
REVOKE ALL ON FUNCTION public.increment_user_credits(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_user_credits(uuid, integer) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_user_credits(uuid, integer) TO service_role;
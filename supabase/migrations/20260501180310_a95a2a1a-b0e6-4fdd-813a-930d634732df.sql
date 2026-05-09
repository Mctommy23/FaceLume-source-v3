-- Add is_admin flag to profiles, mirroring any existing admin role from user_roles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Backfill from user_roles so existing admins keep access.
UPDATE public.profiles p
SET is_admin = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = 'admin'
);

-- SECURITY DEFINER function so RLS policies can check admin without recursion.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _user_id), false);
$$;

-- Allow admins to read every profile (existing policy already allows authenticated SELECT,
-- but we add explicit admin update for the deactivate action below).
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Admin read access for activation_orders, credit_purchases, usage_logs.
DROP POLICY IF EXISTS "Admins can view all activation orders" ON public.activation_orders;
CREATE POLICY "Admins can view all activation orders"
ON public.activation_orders FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all credit purchases" ON public.credit_purchases;
CREATE POLICY "Admins can view all credit purchases"
ON public.credit_purchases FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all usage logs" ON public.usage_logs;
CREATE POLICY "Admins can view all usage logs"
ON public.usage_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
## Goal

Set the password for `mctommy2002@gmail.com` (user id `f245938c-9e03-4cc4-9832-8f9a53595488`) to `Veloxis!1` server-side, since the password recovery email flow isn't working for you.

## Approach

Create a temporary admin-only edge function that uses the `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.updateUserById()` and update your password directly. Run it once, then delete it so it can't be reused.

## Steps

1. **Create edge function** `supabase/functions/admin-reset-password/index.ts`
   - Accepts `{ email, newPassword }` in the request body
   - Verifies the caller's JWT and confirms they are an admin (`profiles.is_admin = true`) — so the function can't be abused even if it lingers
   - Looks up the auth user by email via the admin API
   - Calls `auth.admin.updateUserById(userId, { password: newPassword })`
   - Returns success/error JSON with CORS headers

2. **Invoke it once** from the browser console (while you're signed in as admin) or via a curl command, passing `mctommy2002@gmail.com` and `Veloxis!1`.

3. **Verify** by signing in at `/get-started` with the new password.

4. **Delete the edge function** immediately after the reset succeeds so it isn't left exposed.

## Notes

- Password `Veloxis!1` is 9 chars, includes upper/lower/digit/symbol — passes default Supabase strength requirements.
- Your current session is already signed in as admin (per the auth logs), so the admin gate will let the call through.
- After this, your existing browser session may still be valid; you can sign out and back in to confirm the new password works.

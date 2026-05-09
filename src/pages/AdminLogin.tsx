import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  // If already signed in, check admin status and route accordingly.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.is_admin) {
        navigate("/admin", { replace: true });
      } else {
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-in failed");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_admin) {
        await supabase.auth.signOut();
        toast.error("This account does not have admin access.");
        setSubmitting(false);
        return;
      }

      toast.success("Welcome, admin");
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to sign in");
      setSubmitting(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const signedInAsNonAdmin = !!user;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to site
        </Link>
        <Card className="border-border/60">
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Admin sign in</CardTitle>
              <CardDescription>
                Restricted area. Only authorized administrators may continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {signedInAsNonAdmin ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You are signed in as <span className="text-foreground">{user?.email}</span>, but
                  this account is not an admin.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      await supabase.auth.signOut();
                    }}
                  >
                    Sign out
                  </Button>
                  <Button asChild className="flex-1">
                    <Link to="/">Go home</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in to admin"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;

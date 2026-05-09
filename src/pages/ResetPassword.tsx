import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate("/dashboard", { replace: true });
  };

  return (
    <>
      <title>Reset Password — FaceLume</title>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />

        <div className="relative w-full max-w-md">
          <div className="absolute -inset-1 bg-gradient-primary opacity-40 blur-2xl rounded-3xl" />
          <div className="relative glass-strong rounded-3xl p-8">
            <div className="flex justify-center mb-6"><Logo /></div>
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-full bg-primary/20 border border-primary/40 mb-3">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-display font-black text-2xl">Set New Password</h1>
              <p className="text-sm text-muted-foreground mt-1">Choose a strong, secure password.</p>
            </div>
            <form onSubmit={handle} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-mono">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="pl-10 bg-background/40" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Confirm</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10 bg-background/40" required />
                </div>
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Update Password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;

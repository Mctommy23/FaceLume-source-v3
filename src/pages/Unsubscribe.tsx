import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "invalid" | "already" | "done" | "error" | "submitting";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); setMsg("Missing token."); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, { headers: { apikey: ANON } });
        const data = await res.json();
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else { setState("invalid"); setMsg(data.error || "Invalid token."); }
      } catch {
        setState("error"); setMsg("Could not reach the server.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else { setState("error"); setMsg(data.error || "Failed."); }
    } catch {
      setState("error"); setMsg("Network error.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="relative glass-strong rounded-3xl p-8 md:p-10 max-w-md w-full text-center space-y-5">
        <div className="inline-flex p-3 rounded-full bg-primary/15 border border-primary/30">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-display font-black text-2xl">Email preferences</h1>

        {state === "loading" && <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />}

        {state === "valid" && (
          <>
            <p className="text-muted-foreground text-sm">
              Click below to unsubscribe from FaceLume notification emails. You'll still receive critical account emails (password reset, security).
            </p>
            <Button variant="hero" size="lg" className="w-full" onClick={confirm}>
              Confirm unsubscribe
            </Button>
          </>
        )}

        {state === "submitting" && <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />}

        {state === "done" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm">You've been unsubscribed. Sorry to see you go.</p>
            <Link to="/"><Button variant="glass">Back to home</Button></Link>
          </>
        )}

        {state === "already" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm">You're already unsubscribed.</p>
            <Link to="/"><Button variant="glass">Back to home</Button></Link>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{msg}</p>
            <Link to="/"><Button variant="glass">Back to home</Button></Link>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;

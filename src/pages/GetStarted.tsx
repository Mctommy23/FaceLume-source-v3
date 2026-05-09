import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User as UserIcon, Sparkles, ArrowRight, ShieldCheck, KeyRound, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const signUpSchema = z
  .object({
    display_name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
    email: z.string().trim().email("Invalid email").max(255),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

const OTP_TTL_SECONDS = 120;

const friendlyError = (msg: string) => {
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("Invalid login credentials")) return "Invalid email or password.";
  if (msg.includes("Token has expired") || msg.includes("expired")) return "Code expired. Request a new one.";
  if (msg.includes("Invalid token") || msg.includes("invalid")) return "Invalid code. Check your email and try again.";
  if (msg.includes("Email not confirmed")) return "Please verify your email with the code we sent.";
  return msg;
};

const isElectron = () =>
  typeof window !== "undefined" && Boolean((window as any).facelume?.isElectron);

// Public website URL where desktop users complete signup.
const WEB_SIGNUP_URL = "https://www.getfacelume.com/get-started";

const openSignupOnWeb = () => {
  const api = (window as any).facelume;
  if (api?.openExternal) api.openExternal(WEB_SIGNUP_URL);
  else window.open(WEB_SIGNUP_URL, "_blank", "noopener,noreferrer");
};

const GetStarted = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const electron = isElectron();
  const [tab, setTab] = useState<"signin" | "signup">(electron ? "signin" : "signup");
  const [busy, setBusy] = useState<string | null>(null);

  // Sign up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPwd, setSuPwd] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

  // OTP step
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpRemaining, setOtpRemaining] = useState<number>(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpAutoSubmitted, setOtpAutoSubmitted] = useState(false);
  const tickerRef = useRef<number | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const otpFormRef = useRef<HTMLFormElement | null>(null);

  // Sign in state
  const [siEmail, setSiEmail] = useState("");
  const [siPwd, setSiPwd] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/activate", { replace: true });
  }, [user, loading, navigate]);

  // Countdown ticker for OTP expiry + resend cooldown
  useEffect(() => {
    if (!otpEmail) return;
    const tick = () => {
      const now = Date.now();
      setOtpRemaining(Math.max(0, Math.ceil((otpExpiresAt - now) / 1000)));
      setResendCooldown(Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)));
    };
    tick();
    tickerRef.current = window.setInterval(tick, 500);
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, [otpEmail, otpExpiresAt, resendAvailableAt]);

  const RESEND_COOLDOWN_SECONDS = 30;

  // Auto-focus the OTP input when entering the verification step
  useEffect(() => {
    if (!otpEmail) return;
    // Slight delay so the field is mounted and any layout shift settled
    const t = window.setTimeout(() => otpInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [otpEmail]);

  // WebOTP API — Chrome on Android can read SMS codes; harmless on other browsers.
  // Also catches programmatic autofill (one-time-code keyboard suggestions).
  useEffect(() => {
    if (!otpEmail) return;
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as unknown as {
      get: (opts: { otp: { transport: string[] }; signal: AbortSignal }) => Promise<{ code?: string } | null>;
    })
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((cred) => {
        const code = cred?.code?.replace(/\D/g, "").slice(0, 6);
        if (code && code.length === 6) {
          setOtpCode(code);
        }
      })
      .catch(() => { /* user dismissed or unsupported */ });
    return () => ac.abort();
  }, [otpEmail]);

  // Auto-submit when 6 digits are entered (only once per fill)
  useEffect(() => {
    if (otpCode.length === 6 && !otpAutoSubmitted && otpRemaining > 0 && !busy) {
      setOtpAutoSubmitted(true);
      otpFormRef.current?.requestSubmit();
    }
    if (otpCode.length < 6 && otpAutoSubmitted) {
      setOtpAutoSubmitted(false);
    }
  }, [otpCode, otpAutoSubmitted, otpRemaining, busy]);

  const startOtpCountdown = () => {
    const now = Date.now();
    setOtpExpiresAt(now + OTP_TTL_SECONDS * 1000);
    setResendAvailableAt(now + RESEND_COOLDOWN_SECONDS * 1000);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({
      display_name: suName,
      email: suEmail,
      password: suPwd,
      confirm_password: suConfirm,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy("signup");
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/activate`,
        data: { display_name: parsed.data.display_name },
      },
    });
    setBusy(null);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    // Supabase returns user with empty identities[] when the email
    // is already registered & confirmed (no email is sent in that case).
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast.error("This email is already registered. Please sign in instead.");
      setSiEmail(parsed.data.email);
      setTab("signin");
      return;
    }
    setOtpEmail(parsed.data.email);
    setOtpCode("");
    startOtpCountdown();
    toast.success("We sent a 6-digit code to your email");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) return;
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter the 6-digit code");
      return;
    }
    if (otpRemaining <= 0) {
      toast.error("Code expired. Request a new one.");
      return;
    }
    setBusy("verify");
    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otpCode,
      type: "signup",
    });
    setBusy(null);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success("Email verified");
    // Fire-and-forget welcome email (best effort — never blocks the flow)
    void supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "welcome-signup",
        recipientEmail: otpEmail,
        idempotencyKey: `welcome-${otpEmail}`,
        templateData: { name: suName || undefined },
      },
    }).catch(() => { /* ignore */ });
    navigate("/activate", { replace: true });
  };

  const handleResendOtp = async () => {
    if (!otpEmail) return;
    if (resendCooldown > 0) {
      toast.error(`Please wait ${resendCooldown}s before requesting another code`);
      return;
    }
    setBusy("resend");
    // Optimistically start the cooldown to prevent rapid double-clicks
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: otpEmail,
      options: { emailRedirectTo: `${window.location.origin}/activate` },
    });
    setBusy(null);
    if (error) {
      // Honor Supabase's own rate limit if it kicks in
      const match = /(\d+)\s*second/i.exec(error.message);
      if (match) {
        setResendAvailableAt(Date.now() + parseInt(match[1], 10) * 1000);
      }
      toast.error(friendlyError(error.message));
      return;
    }
    setOtpCode("");
    startOtpCountdown();
    toast.success("New code sent");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email: siEmail, password: siPwd });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(null);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success("Welcome back");
    navigate("/activate", { replace: true });
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/activate`,
    });
    if (result.error) {
      setBusy(null);
      toast.error("Sign in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate("/activate", { replace: true });
  };

  const handleForgot = async () => {
    if (!siEmail) {
      toast.error("Enter your email above first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(siEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  const formatRemaining = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <title>Get Started — FaceLume</title>
      <meta name="description" content="Create your FaceLume account or sign in to access the live AI streaming studio." />

      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        {/* Background effects */}
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-primary/30 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-secondary/30 blur-3xl rounded-full" />

        <div className="relative w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Branding side */}
          <div className="hidden lg:flex flex-col gap-6 p-8">
            <Link to="/"><Logo /></Link>
            <h1 className="font-display font-black text-5xl leading-tight">
              Illuminate<br />Your <span className="neon-text">Identity</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-md">
              Join thousands of streamers transforming their face into any character in real time with AI.
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
              <Sparkles className="w-4 h-4 text-primary" />
              100 free credits when you sign up
            </div>
          </div>

          {/* Auth card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-primary opacity-40 blur-2xl rounded-3xl" />
            <div className="relative glass-strong rounded-3xl p-8 md:p-10">
              <div className="lg:hidden mb-6 flex justify-center">
                <Link to="/"><Logo /></Link>
              </div>

              {otpEmail ? (
                <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-4 rounded-full bg-primary/20 border border-primary/40">
                      <ShieldCheck className="w-9 h-9 text-primary" />
                    </div>
                    <h2 className="font-display font-bold text-2xl">Enter verification code</h2>
                    <p className="text-sm text-muted-foreground">
                      We sent a 6-digit code to<br />
                      <span className="text-primary-glow font-mono">{otpEmail}</span>
                    </p>
                  </div>

                  <Field icon={KeyRound} label="6-digit code" id="otp-code">
                    <Input
                      id="otp-code"
                      ref={otpInputRef}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        if (pasted) {
                          e.preventDefault();
                          setOtpCode(pasted);
                        }
                      }}
                      placeholder="123456"
                      className="text-center text-2xl font-mono tracking-[0.5em]"
                      required
                    />
                  </Field>

                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground -mt-2">
                    <ClipboardPaste className="w-3 h-3" />
                    Tip: paste your 6-digit code to auto-verify
                  </p>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={otpRemaining > 0 ? "text-muted-foreground" : "text-destructive"}>
                      {otpRemaining > 0 ? `Expires in ${formatRemaining(otpRemaining)}` : "Code expired"}
                    </span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={busy === "resend" || resendCooldown > 0}
                      aria-live="polite"
                      className="text-primary-glow hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {busy === "resend"
                        ? "Sending…"
                        : resendCooldown > 0
                          ? `Resend in ${formatRemaining(resendCooldown)}`
                          : "Resend code"}
                    </button>
                  </div>

                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy === "verify" || otpRemaining <= 0}>
                    {busy === "verify" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    Verify & continue
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setOtpEmail(null); setOtpCode(""); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Use a different email
                  </button>
                </form>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h2 className="font-display font-black text-3xl mb-2">
                      {tab === "signup" ? "Create Account" : "Welcome Back"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {tab === "signup" ? "Start streaming as anyone, in seconds." : "Sign in to access your studio."}
                    </p>
                  </div>

                  <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full mb-6 bg-background/40">
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signup">
                      {electron ? (
                        <div className="space-y-5 text-center py-2">
                          <div className="inline-flex p-4 rounded-full bg-primary/20 border border-primary/40">
                            <Sparkles className="w-8 h-8 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-display font-bold text-xl">Create your account on the web</h3>
                            <p className="text-sm text-muted-foreground">
                              For your security, account creation happens in your browser. Once you've signed up, come back here and sign in.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="hero"
                            size="lg"
                            className="w-full"
                            onClick={openSignupOnWeb}
                          >
                            <ArrowRight />
                            Open sign up in browser
                          </Button>
                          <button
                            type="button"
                            onClick={() => setTab("signin")}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Already have an account? Sign in
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSignUp} className="space-y-4">
                          <Field icon={UserIcon} label="Display name" id="su-name">
                            <Input id="su-name" value={suName} onChange={(e) => setSuName(e.target.value)} placeholder="NeonGamer" required />
                          </Field>
                          <Field icon={Mail} label="Email" id="su-email">
                            <Input id="su-email" type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} placeholder="you@example.com" required />
                          </Field>
                          <Field icon={Lock} label="Password" id="su-pwd">
                            <Input id="su-pwd" type="password" value={suPwd} onChange={(e) => setSuPwd(e.target.value)} placeholder="Min 8 · upper, lower & number" required />
                          </Field>
                          <Field icon={Lock} label="Confirm password" id="su-confirm">
                            <Input id="su-confirm" type="password" value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)} placeholder="Re-enter your password" required />
                          </Field>
                          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy === "signup"}>
                            {busy === "signup" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                            Create Account
                          </Button>
                        </form>
                      )}
                    </TabsContent>

                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <Field icon={Mail} label="Email" id="si-email">
                          <Input id="si-email" type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} placeholder="you@example.com" required />
                        </Field>
                        <Field icon={Lock} label="Password" id="si-pwd">
                          <Input id="si-pwd" type="password" value={siPwd} onChange={(e) => setSiPwd(e.target.value)} required />
                        </Field>
                        <button type="button" onClick={handleForgot} className="text-xs text-primary-glow hover:underline">
                          Forgot password?
                        </button>
                        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy === "signin"}>
                          {busy === "signin" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                          Sign In
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>

                  {!electron && (
                    <>
                      <div className="my-6 flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs font-mono text-muted-foreground tracking-widest">OR</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="glass" onClick={() => handleOAuth("google")} disabled={!!busy}>
                          {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
                          Google
                        </Button>
                        <Button variant="glass" onClick={() => handleOAuth("apple")} disabled={!!busy}>
                          {busy === "apple" ? <Loader2 className="animate-spin" /> : <AppleIcon />}
                          Apple
                        </Button>
                      </div>
                    </>
                  )}

                  <p className="text-xs text-center text-muted-foreground mt-6">
                    By continuing you agree to our Terms & Privacy Policy.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Field = ({ icon: Icon, label, id, children }: { icon: React.ComponentType<{ className?: string }>; label: string; id: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground font-mono">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      <div className="[&>input]:pl-10 [&>input]:bg-background/40 [&>input]:border-border/60 [&>input]:focus-visible:border-primary [&>input]:focus-visible:ring-primary/40">
        {children}
      </div>
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 2.9 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3 .7c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-1-2.4-3.9zM14.1 5.6c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3z"/>
  </svg>
);

export default GetStarted;

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  credits: number;
  is_activated: boolean;
  is_admin: boolean;
  license_key: string | null;
  activated_at: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_CACHE_KEY = "facelume:profile-cache";

const readCachedProfile = (userId: string | undefined): Profile | null => {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (parsed && parsed.id === userId) return parsed;
  } catch { /* ignore */ }
  return null;
};

const writeCachedProfile = (p: Profile | null) => {
  if (typeof window === "undefined") return;
  try {
    if (p) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch { /* ignore */ }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, plan, credits, is_activated, is_admin, license_key, activated_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data);
    writeCachedProfile(data);
  };

  useEffect(() => {
    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Hydrate from cache instantly so gated routes don't block on network.
        const cached = readCachedProfile(newSession.user.id);
        if (cached) setProfile(cached);
        // Defer Supabase calls
        setTimeout(() => fetchProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
        writeCachedProfile(null);
      }
    });

    // 2. Then check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        const cached = readCachedProfile(existing.user.id);
        if (cached) setProfile(cached);
        // Background refresh — don't block UI on this.
        fetchProfile(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    writeCachedProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

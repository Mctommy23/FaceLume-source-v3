import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Reset = () => {
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      try {
        const dbs: { name?: string }[] =
          (await (indexedDB as any).databases?.()) ?? [];
        for (const d of dbs) {
          if (d.name) indexedDB.deleteDatabase(d.name);
        }
      } catch {
        /* ignore */
      }
      // Hard reload to drop any in-memory React state
      window.location.replace("/get-started");
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Resetting FaceLume…</p>
    </div>
  );
};

export default Reset;

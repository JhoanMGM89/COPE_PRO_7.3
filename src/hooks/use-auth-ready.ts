import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readSessionBackup, saveSessionBackup } from "@/lib/auth-session";

export const useAuthReady = () => {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    let isRestoring = false;

    const applySession = (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsReady(true);
    };

    const restoreFromBackup = async () => {
      if (isRestoring) return null;

      const backup = readSessionBackup();
      if (!backup) return null;

      isRestoring = true;
      try {
        const { data, error } = await supabase.auth.setSession(backup);
        if (error || !data.session) return null;
        if (!mounted) return data.session;
        saveSessionBackup(data.session);
        applySession(data.session);
        return data.session;
      } catch {
        return null;
      } finally {
        isRestoring = false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      if (nextSession) saveSessionBackup(nextSession);
      applySession(nextSession);
    });

    const initializeSession = async () => {
      try {
        const { data: { session: restoredSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (restoredSession) {
          saveSessionBackup(restoredSession);
          applySession(restoredSession);
          return;
        }

        const restoredFromBackup = await restoreFromBackup();
        if (!mounted || restoredFromBackup) return;
        applySession(null);
      } catch {
        if (!mounted) return;
        const restoredFromBackup = await restoreFromBackup();
        if (!mounted || restoredFromBackup) return;
        applySession(null);
      }
    };

    const handleOnline = () => {
      if (!sessionRef.current) void restoreFromBackup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Tab became visible again — ensure session is still alive
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (!mounted) return;
        if (current) {
          saveSessionBackup(current);
          applySession(current);
        } else if (!sessionRef.current) {
          // Only restore from backup if we don't already have a session in state
          void restoreFromBackup();
        } else {
          // We had a session in state but Supabase lost it — restore from backup
          void restoreFromBackup();
        }
      }).catch(() => {
        // Network error — keep current session, don't blank out
      });
    };

    void initializeSession();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  return { isReady, session, user };
};

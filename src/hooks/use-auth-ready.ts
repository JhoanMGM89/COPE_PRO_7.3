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

    void initializeSession();
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      subscription.unsubscribe();
    };
  }, []);

  return { isReady, session, user };
};

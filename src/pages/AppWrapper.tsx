import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { clearAgentIdentity, clearSessionBackup, saveAgentIdentity } from "@/lib/auth-session";

const AppWrapper = () => {
  const [agentName, setAgentName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");
  const navigate = useNavigate();
  const { isReady, session } = useAuthReady();
  const hasEverLoggedIn = useRef(false);
  const lastSessionUserId = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      // Only redirect to login if we never had a session or user explicitly logged out
      // Don't redirect on transient null (tab switch, network hiccup)
      if (!hasEverLoggedIn.current) {
        setAgentName("");
        setIsAdmin(false);
        setUserId("");
        clearAgentIdentity();
        navigate("/", { replace: true });
      }
      return;
    }

    // If same user session, don't re-fetch
    if (lastSessionUserId.current === session.user.id && agentName) return;

    const init = async () => {
      hasEverLoggedIn.current = true;
      lastSessionUserId.current = session.user.id;
      setUserId(session.user.id);

      const [{ data: agent, error: agentError }, { data: role, error: roleError }] = await Promise.all([
        supabase.from("agents").select("name").eq("id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle(),
      ]);

      if (agentError || roleError) return;

      if (!agent) {
        hasEverLoggedIn.current = false;
        lastSessionUserId.current = null;
        clearAgentIdentity();
        clearSessionBackup();
        await supabase.auth.signOut({ scope: "local" });
        navigate("/", { replace: true });
        return;
      }

      setAgentName(agent.name);
      setIsAdmin(Boolean(role));
      saveAgentIdentity(agent.name);
    };

    init();
  }, [isReady, session, navigate]);

  const logout = async () => {
    hasEverLoggedIn.current = false;
    lastSessionUserId.current = null;
    setAgentName("");
    setIsAdmin(false);
    setUserId("");
    clearAgentIdentity();
    clearSessionBackup();
    await supabase.auth.signOut({ scope: "local" });
    navigate("/", { replace: true });
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const modulePath = `${import.meta.env.BASE_URL}modules/GENERADOR_DE_PLANTILLAS.html`;
  const iframeSrc = `${modulePath}?agentName=${encodeURIComponent(agentName)}&userId=${encodeURIComponent(userId)}&supabaseUrl=${encodeURIComponent(supabaseUrl)}&supabaseKey=${encodeURIComponent(supabaseKey)}`;
  const sessionBackup = session?.access_token && session?.refresh_token
    ? { access_token: session.access_token, refresh_token: session.refresh_token }
    : null;

  const enviarSesionAlModulo = () => {
    if (!iframeRef.current?.contentWindow || !agentName || !userId) return;

    iframeRef.current.contentWindow.postMessage({
      type: "SET_SESSION",
      nombreAgente: agentName,
      userId,
      sessionBackup,
    }, "*");
  };

  useEffect(() => {
    if (!agentName || !userId || !sessionBackup) return;

    const syncSession = () => enviarSesionAlModulo();
    const timeoutId = window.setTimeout(syncSession, 150);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncSession();
    };

    window.addEventListener("focus", syncSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", syncSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [agentName, userId, sessionBackup]);

  if (!isReady) {
    return <div className="h-screen bg-black" />;
  }

  return (
    <div className="h-screen flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">👤 {agentName || "Agente"}</span>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button size="sm" onClick={() => navigate("/admin")} className="bg-blue-600 text-white hover:bg-blue-700 text-xs">
              ⚙️ Admin
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={logout} className="text-xs">
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {agentName && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          onLoad={enviarSesionAlModulo}
          title="Generador de Plantillas"
          className="flex-1 w-full border-none"
        />
      )}
    </div>
  );
};

export default AppWrapper;

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      setAgentName("");
      setIsAdmin(false);
      setUserId("");
      clearAgentIdentity();
      navigate("/", { replace: true });
      return;
    }

    const init = async () => {
      setAgentName("");
      setIsAdmin(false);
      setUserId(session.user.id);

      const [{ data: agent, error: agentError }, { data: role, error: roleError }] = await Promise.all([
        supabase.from("agents").select("name").eq("id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle(),
      ]);

      if (agentError || roleError) return;

      if (!agent) {
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
          src={iframeSrc}
          title="Generador de Plantillas"
          className="flex-1 w-full border-none"
        />
      )}
    </div>
  );
};

export default AppWrapper;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const AppWrapper = () => {
  const [agentName, setAgentName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }

      setUserId(session.user.id);

      // Get agent name
      const { data: agent } = await supabase.from("agents").select("name").eq("id", session.user.id).maybeSingle();
      if (agent) setAgentName(agent.name);

      // Check if admin
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (role) setIsAdmin(true);
    };
    init();
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Build the iframe URL with agent info as query params
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const modulePath = `${window.location.protocol === "file:" ? "modules" : "/modules"}/GENERADOR_DE_PLANTILLAS.html`;
  const iframeSrc = `${modulePath}?agentName=${encodeURIComponent(agentName)}&userId=${encodeURIComponent(userId)}&supabaseUrl=${encodeURIComponent(supabaseUrl)}&supabaseKey=${encodeURIComponent(supabaseKey)}`;

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Top bar */}
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

      {/* Iframe */}
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

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Agent {
  id: string;
  nit: string;
  name: string;
  created_at: string;
}

interface RecordRow {
  id: string;
  module: string;
  template_type: string | null;
  id_mostrado: string | null;
  tipo_falla: string | null;
  observation: string | null;
  created_at: string;
  agents: { name: string; nit: string } | null;
}

const Admin = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState<"agents" | "records">("agents");
  const [newNit, setNewNit] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checkAdmin = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/"); return; }

    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
    if (!data) { navigate("/app"); toast.error("No tiene permisos de administrador"); }
  }, [navigate]);

  const loadAgents = useCallback(async () => {
    const { data } = await supabase.functions.invoke("admin-agents", { body: { action: "list" } });
    if (data?.agents) setAgents(data.agents);
  }, []);

  const loadRecords = useCallback(async () => {
    const body: Record<string, string> = { action: "export-records" };
    if (filterAgent) body.agent_id = filterAgent;
    if (filterModule) body.module = filterModule;
    const { data } = await supabase.functions.invoke("admin-agents", { body });
    if (data?.records) setRecords(data.records);
  }, [filterAgent, filterModule]);

  useEffect(() => { checkAdmin(); }, [checkAdmin]);
  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);

  const createAgent = async () => {
    if (!newNit.trim() || !newName.trim() || !newPassword.trim()) {
      toast.error("Complete todos los campos");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-agents", {
      body: { action: "create", nit: newNit.trim(), name: newName.trim().toUpperCase(), password: newPassword.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Error al crear agente");
    } else {
      toast.success("Agente creado");
      setNewNit(""); setNewName(""); setNewPassword("");
      loadAgents();
    }
    setLoading(false);
  };

  const updateAgent = async (id: string) => {
    if (!editName.trim()) { toast.error("El nombre es obligatorio"); return; }
    setLoading(true);
    const body: Record<string, string> = { action: "update", id, name: editName.trim().toUpperCase() };
    if (editPassword.trim()) body.password = editPassword.trim();
    const { data, error } = await supabase.functions.invoke("admin-agents", { body });
    if (error || data?.error) {
      toast.error(data?.error || "Error al actualizar");
    } else {
      toast.success("Agente actualizado");
      setEditingId(null);
      loadAgents();
    }
    setLoading(false);
  };

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al agente ${name}? Se eliminarán todos sus registros.`)) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-agents", { body: { action: "delete", id } });
    if (error || data?.error) {
      toast.error(data?.error || "Error al eliminar");
    } else {
      toast.success("Agente eliminado");
      loadAgents();
    }
    setLoading(false);
  };

  const exportExcel = () => {
    if (records.length === 0) { toast.error("No hay registros"); return; }

    let html = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0d6efd" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="REGISTROS"><Table>
<Row><Cell ss:StyleID="h"><Data ss:Type="String">FECHA</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">AGENTE</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">NIT</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">MÓDULO</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">TIPO</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">ID</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">FALLA</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">OBSERVACION</Data></Cell></Row>`;

    const esc = (t: string | null | undefined) => {
      if (!t) return "";
      return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

    records.forEach((r) => {
      html += `<Row>
<Cell><Data ss:Type="String">${esc(new Date(r.created_at).toLocaleString("es-CO"))}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.agents?.name)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.agents?.nit)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.module)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.template_type)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.id_mostrado)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.tipo_falla)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.observation)}</Data></Cell>
</Row>`;
    });

    html += `</Table></Worksheet></Workbook>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Registros_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    toast.success(`${records.length} registros exportados`);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/app")} className="bg-green-600 text-white hover:bg-green-700">
              Ir a Plantillas
            </Button>
            <Button variant="destructive" onClick={logout}>Cerrar Sesión</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button onClick={() => setTab("agents")} variant={tab === "agents" ? "default" : "outline"} className={tab !== "agents" ? "border-zinc-700 text-gray-300" : "bg-blue-600"}>
            Gestión de Agentes
          </Button>
          <Button onClick={() => setTab("records")} variant={tab === "records" ? "default" : "outline"} className={tab === "records" ? "bg-green-600 text-white hover:bg-green-700" : "border-green-600 text-white hover:bg-green-700/20"}>
            Registros / Exportar
          </Button>
        </div>

        {tab === "agents" && (
          <div className="space-y-6">
            {/* Create Agent */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-4">Crear Nuevo Agente</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-400">NIT</Label>
                  <Input value={newNit} onChange={(e) => setNewNit(e.target.value)} placeholder="NIT del agente" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <Label className="text-gray-400">Nombre</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <Label className="text-gray-400">Contraseña</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Contraseña" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="flex items-end">
                  <Button onClick={createAgent} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                    Crear Agente
                  </Button>
                </div>
              </div>
            </div>

            {/* Agent List */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-4">Agentes Registrados ({agents.length})</h2>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                    {editingId === agent.id ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mr-4">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre" className="bg-zinc-700 border-zinc-600 text-white" />
                        <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" className="bg-zinc-700 border-zinc-600 text-white" />
                        <div className="flex gap-2">
                          <Button onClick={() => updateAgent(agent.id)} disabled={loading} size="sm" className="bg-blue-600">Guardar</Button>
                          <Button onClick={() => setEditingId(null)} variant="outline" size="sm" className="border-zinc-600 text-gray-300">Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-semibold text-white">{agent.name}</span>
                          <span className="ml-3 text-sm text-gray-400">NIT: {agent.nit}</span>
                          {agent.nit === "admincope" && <span className="ml-2 px-2 py-0.5 bg-red-600 text-xs rounded-full">ADMIN</span>}
                        </div>
                        <div className="flex gap-2">
                          {agent.nit !== "admincope" && (
                            <>
                              <Button size="sm" variant="outline" className="border-zinc-600 text-gray-300" onClick={() => { setEditingId(agent.id); setEditName(agent.name); setEditPassword(""); }}>
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteAgent(agent.id, agent.name)}>
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {agents.length === 0 && <p className="text-gray-500 text-center py-4">No hay agentes registrados</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "records" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-4">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-400">Módulo</Label>
                  <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3">
                    <option value="">Todos</option>
                    <option value="CREACION">CREACIÓN</option>
                    <option value="AVERIA">AVERÍAS</option>
                    <option value="ATP">ATP</option>
                    <option value="SERVICE NOW">SERVICE NOW</option>
                    <option value="RECHAZO_SYTEX">RECHAZO SYTEX</option>
                    <option value="RECHAZO_GDM">RECHAZO GDM</option>
                  </select>
                </div>
                <div>
                  <Label className="text-gray-400">Agente</Label>
                  <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3">
                    <option value="">Todos</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadRecords} className="bg-blue-600 hover:bg-blue-700">Buscar</Button>
                  <Button onClick={exportExcel} className="bg-green-600 hover:bg-green-700">Exportar Excel</Button>
                </div>
              </div>
            </div>

            {/* Records Table */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4">Registros ({records.length})</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left p-2 text-gray-400">FECHA</th>
                    <th className="text-left p-2 text-gray-400">AGENTE</th>
                    <th className="text-left p-2 text-gray-400">MÓDULO</th>
                    <th className="text-left p-2 text-gray-400">TIPO</th>
                    <th className="text-left p-2 text-gray-400">ID</th>
                    <th className="text-left p-2 text-gray-400">FALLA</th>
                    <th className="text-left p-2 text-gray-400 max-w-xs">OBSERVACIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="p-2 text-xs">{new Date(r.created_at).toLocaleString("es-CO")}</td>
                      <td className="p-2">{r.agents?.name}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          r.module === "CREACION" ? "bg-green-600/20 text-green-400" :
                          r.module === "AVERIA" ? "bg-orange-600/20 text-orange-400" :
                          r.module === "ATP" ? "bg-yellow-600/20 text-yellow-400" :
                          r.module === "SERVICE NOW" ? "bg-blue-600/20 text-blue-400" :
                          "bg-red-600/20 text-red-400"
                        }`}>{r.module}</span>
                      </td>
                      <td className="p-2 text-xs">{r.template_type}</td>
                      <td className="p-2 text-xs font-mono">{r.id_mostrado}</td>
                      <td className="p-2 text-xs">{r.tipo_falla}</td>
                      <td className="p-2 text-xs max-w-xs truncate">{r.observation?.substring(0, 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 && <p className="text-gray-500 text-center py-8">No hay registros</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, X, Trash2, Search } from "lucide-react";
import { clearSessionBackup } from "@/lib/auth-session";

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
  incidencia: string | null;
  ot: string | null;
  cs: string | null;
  created_at: string;
  agents: { name: string; nit: string } | null;
}

interface IpEntry {
  id: string;
  ip: string;
  olt: string;
  localidad: string;
  coinversor: string;
  tecnologia: string;
  grupo_trabajo: string;
  articulo_config: string;
}

const PROTECTED_NITS = ["admincope", "1143330990"];
const INVALID_SERVICE_NOW_VALUES = new Set(["", "-", "N/A", "S/N", "SIN DATO", "NULL", "UNDEFINED"]);

const isServiceNowModule = (module: string | null | undefined) => {
  const normalized = String(module || "").trim().toUpperCase();
  return normalized === "SERVICE NOW" || normalized === "SERVICE_NOW";
};

const normalizeServiceNowValue = (value: string | null | undefined) => {
  const cleaned = String(value || "").trim();
  return INVALID_SERVICE_NOW_VALUES.has(cleaned.toUpperCase()) ? "" : cleaned;
};

const extractServiceNowFromObservation = (observation: string | null | undefined) => {
  const match = String(observation || "").match(/SERVICE NOW\s*:\s*([^\n\r]+)/i);
  return normalizeServiceNowValue(match?.[1] || "");
};

const getEffectiveCs = (record: Pick<RecordRow, "module" | "cs" | "id_mostrado" | "observation">) => {
  const direct = normalizeServiceNowValue(record.cs);
  if (direct) return direct;
  if (!isServiceNowModule(record.module)) return "";
  return normalizeServiceNowValue(record.id_mostrado) || extractServiceNowFromObservation(record.observation);
};

const scrollClass = "overflow-x-auto";
const scrollStyle: React.CSSProperties = {};

const Admin = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState<"agents" | "records" | "ips">("agents");
  const [newNit, setNewNit] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterSubmodule, setFilterSubmodule] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewingObs, setViewingObs] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteDateFrom, setDeleteDateFrom] = useState("");
  const [deleteDateTo, setDeleteDateTo] = useState("");
  // IP Base state
  const [ipEntries, setIpEntries] = useState<IpEntry[]>([]);
  const [ipSearch, setIpSearch] = useState("");
  const [editingIpId, setEditingIpId] = useState<string | null>(null);
  const [editIpData, setEditIpData] = useState<Partial<IpEntry>>({});
  const [newIp, setNewIp] = useState({ ip: "", olt: "", localidad: "", coinversor: "", tecnologia: "", grupo_trabajo: "", articulo_config: "" });
  const [showAddIp, setShowAddIp] = useState(false);

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
    if (filterSubmodule) body.template_type = filterSubmodule;
    const { data, error } = await supabase.functions.invoke("admin-agents", { body });
    if (error || data?.error) { setRecords([]); toast.error(data?.error || "Error al cargar registros"); return; }
    let recs: RecordRow[] = data?.records ?? [];
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0, 0, 0, 0);
      recs = recs.filter(r => new Date(r.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
      recs = recs.filter(r => new Date(r.created_at) <= to);
    }
    setRecords(recs);
  }, [filterAgent, filterModule, filterSubmodule, filterDateFrom, filterDateTo]);

  const loadIps = useCallback(async () => {
    const { data, error } = await supabase.from("ip_base").select("*").order("ip");
    if (error) { toast.error("Error cargando IPs"); return; }
    setIpEntries(data || []);
  }, []);

  useEffect(() => { checkAdmin(); }, [checkAdmin]);
  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);
  useEffect(() => { if (tab === "ips") loadIps(); }, [tab, loadIps]);

  const submoduleOptions = Array.from(
    new Set(records.map(r => r.template_type).filter((v): v is string => Boolean(v)))
  ).sort((a, b) => a.localeCompare(b));

  // Filter records by search query (CS, Incidencia, OT)
  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const effectiveCs = getEffectiveCs(r);
    return (r.incidencia || "").toLowerCase().includes(q) ||
           (r.ot || "").toLowerCase().includes(q) ||
           effectiveCs.toLowerCase().includes(q) ||
           (r.id_mostrado || "").toLowerCase().includes(q);
  });

  const createAgent = async () => {
    if (!newNit.trim() || !newName.trim() || !newPassword.trim()) { toast.error("Complete todos los campos"); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-agents", {
      body: { action: "create", nit: newNit.trim(), name: newName.trim().toUpperCase(), password: newPassword.trim() },
    });
    if (error || data?.error) toast.error(data?.error || "Error al crear agente");
    else { toast.success("Agente creado"); setNewNit(""); setNewName(""); setNewPassword(""); loadAgents(); }
    setLoading(false);
  };

  const updateAgent = async (id: string) => {
    if (!editName.trim()) { toast.error("El nombre es obligatorio"); return; }
    setLoading(true);
    const body: Record<string, string> = { action: "update", id, name: editName.trim().toUpperCase() };
    if (editPassword.trim()) body.password = editPassword.trim();
    const { data, error } = await supabase.functions.invoke("admin-agents", { body });
    if (error || data?.error) toast.error(data?.error || "Error al actualizar");
    else { toast.success("Agente actualizado"); setEditingId(null); loadAgents(); }
    setLoading(false);
  };

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al agente ${name}?`)) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-agents", { body: { action: "delete", id } });
    if (error || data?.error) toast.error(data?.error || "Error al eliminar");
    else { toast.success("Agente eliminado"); loadAgents(); }
    setLoading(false);
  };

  const deleteRecord = async (recordId: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.from("records").delete().eq("id", recordId);
    if (error) { toast.error("Error al eliminar registro"); return; }
    toast.success("Registro eliminado");
    setRecords(prev => prev.filter(r => r.id !== recordId));
  };

  const deleteRecordsByDate = async () => {
    if (!deleteDateFrom || !deleteDateTo) { toast.error("Seleccione rango de fechas"); return; }
    const from = new Date(deleteDateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(deleteDateTo); to.setHours(23, 59, 59, 999);
    const toDelete = records.filter(r => {
      const d = new Date(r.created_at);
      return d >= from && d <= to;
    });
    if (toDelete.length === 0) { toast.error("No hay registros en ese rango"); return; }
    if (!confirm(`¿Eliminar ${toDelete.length} registros del rango seleccionado?`)) return;
    const ids = toDelete.map(r => r.id);
    const { error } = await supabase.from("records").delete().in("id", ids);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success(`${toDelete.length} registros eliminados`);
    setRecords(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const broadcastAdminCommand = async (commandType: string, payload: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sesión no válida");
      return false;
    }

    const { error } = await (supabase.from("admin_sync_commands" as never) as any).insert([{ 
      command_type: commandType,
      payload,
      created_by: session.user.id,
      is_active: true,
    }]);

    if (error) {
      toast.error("No fue posible enviar el comando");
      return false;
    }

    return true;
  };

  const syncAgentHistories = async () => {
    const ok = await broadcastAdminCommand("sync_histories", { requested_at: new Date().toISOString() });
    if (!ok) return;
    toast.success("Sincronización enviada a las sesiones activas");
    setTimeout(() => loadRecords(), 1500);
  };

  const clearAgentHistories = async () => {
    if (!confirm("¿Borrar el historial local de plantillas de todos los agentes con sesión iniciada?")) return;
    const ok = await broadcastAdminCommand("clear_histories", { requested_at: new Date().toISOString() });
    if (!ok) return;
    toast.success("Orden de limpieza enviada a las sesiones activas");
  };

  const exportExcel = () => {
    if (filteredRecords.length === 0) { toast.error("No hay registros"); return; }
    const esc = (t: string | null | undefined) => {
      if (!t) return "";
      return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };
    let html = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0d6efd" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="REGISTROS"><Table>
<Row><Cell ss:StyleID="h"><Data ss:Type="String">FECHA</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">AGENTE</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">NIT</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">MÓDULO</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">TIPO</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">ID</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">INCIDENCIA</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">OT</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">CS</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">FALLA</Data></Cell><Cell ss:StyleID="h"><Data ss:Type="String">OBSERVACION</Data></Cell></Row>`;
    filteredRecords.forEach(r => {
      html += `<Row>
<Cell><Data ss:Type="String">${esc(new Date(r.created_at).toLocaleString("es-CO"))}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.agents?.name)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.agents?.nit)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.module)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.template_type)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.id_mostrado)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.incidencia)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(r.ot)}</Data></Cell>
<Cell><Data ss:Type="String">${esc(getEffectiveCs(r))}</Data></Cell>
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
    toast.success(`${filteredRecords.length} registros exportados`);
  };

  // IP functions
  const filteredIps = ipEntries.filter(ip => {
    if (!ipSearch) return true;
    const s = ipSearch.toLowerCase();
    return ip.ip.toLowerCase().includes(s) || ip.olt.toLowerCase().includes(s) || ip.localidad.toLowerCase().includes(s) || ip.coinversor.toLowerCase().includes(s) || ip.tecnologia.toLowerCase().includes(s);
  });

  const saveIpEdit = async (id: string) => {
    const { error } = await supabase.from("ip_base").update({
      ip: editIpData.ip, olt: editIpData.olt, localidad: editIpData.localidad,
      coinversor: editIpData.coinversor, tecnologia: editIpData.tecnologia,
      grupo_trabajo: editIpData.grupo_trabajo, articulo_config: editIpData.articulo_config,
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("IP actualizada");
    setEditingIpId(null);
    loadIps();
  };

  const deleteIp = async (id: string) => {
    if (!confirm("¿Eliminar esta IP?")) return;
    const { error } = await supabase.from("ip_base").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("IP eliminada");
    loadIps();
  };

  const addIp = async () => {
    if (!newIp.ip.trim()) { toast.error("IP es obligatoria"); return; }
    const { error } = await supabase.from("ip_base").insert({
      ip: newIp.ip.trim(), olt: newIp.olt.trim(), localidad: newIp.localidad.trim(),
      coinversor: newIp.coinversor.trim(), tecnologia: newIp.tecnologia.trim(),
      grupo_trabajo: newIp.grupo_trabajo.trim(), articulo_config: newIp.articulo_config.trim()
    });
    if (error) { toast.error(error.message.includes("duplicate") ? "IP ya existe" : "Error al agregar"); return; }
    toast.success("IP agregada");
    setNewIp({ ip: "", olt: "", localidad: "", coinversor: "", tecnologia: "", grupo_trabajo: "", articulo_config: "" });
    setShowAddIp(false);
    loadIps();
  };

  const logout = async () => { clearSessionBackup(); await supabase.auth.signOut(); navigate("/"); };

  const moduleColor = (mod: string) => {
    if (mod === "CREACION") return "bg-green-600/20 text-green-400";
    if (mod === "AVERIA") return "bg-orange-600/20 text-orange-400";
    if (mod === "ATP") return "bg-yellow-600/20 text-yellow-400";
    if (mod === "SERVICE NOW" || mod === "SERVICE_NOW") return "bg-blue-600/20 text-blue-400";
    if (mod.includes("RECHAZO")) return "bg-red-600/20 text-red-400";
    return "bg-zinc-600/20 text-zinc-400";
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: "thin" as any }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/app")} className="bg-green-600 text-white hover:bg-green-700">Ir a Plantillas</Button>
            <Button variant="destructive" onClick={logout}>Cerrar Sesión</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button onClick={() => setTab("agents")} className="bg-blue-600 text-white hover:bg-blue-700">Gestión de Agentes</Button>
          <Button onClick={() => setTab("records")} className="bg-green-600 text-white hover:bg-green-700">Registros / Exportar</Button>
          <Button onClick={() => setTab("ips")} className="bg-yellow-500 text-white hover:bg-yellow-600">Base de IPs</Button>
          {tab === "records" && (
            <>
              <Button onClick={() => setDeleteMode(!deleteMode)}
                className={`${deleteMode ? "bg-red-800" : "bg-red-600"} text-white hover:bg-red-700`}>
                {deleteMode ? "Desactivar Eliminación" : "Eliminar Registros"}
              </Button>
              <Button onClick={syncAgentHistories} className="bg-yellow-500 hover:bg-yellow-600 text-white">Sincronizar</Button>
              <Button onClick={clearAgentHistories} className="bg-purple-600 hover:bg-purple-700 text-white">Borrar Historial de Agentes</Button>
            </>
          )}
        </div>

        {/* AGENTS TAB */}
        {tab === "agents" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-3">Crear Nuevo Agente</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><Label className="text-gray-400">NIT</Label><Input value={newNit} onChange={e => setNewNit(e.target.value)} placeholder="NIT del agente" className="bg-zinc-800 border-zinc-700 text-white" /></div>
                <div><Label className="text-gray-400">Nombre</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo" className="bg-zinc-800 border-zinc-700 text-white" /></div>
                <div><Label className="text-gray-400">Contraseña</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Contraseña" className="bg-zinc-800 border-zinc-700 text-white" /></div>
                <div className="flex items-end"><Button onClick={createAgent} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">Crear Agente</Button></div>
              </div>
            </div>
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-3">Agentes Registrados ({agents.length})</h2>
              <div className={scrollClass} style={scrollStyle}>
                <div className="space-y-2">
                  {agents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      {editingId === agent.id ? (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 mr-3">
                          <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre" className="bg-zinc-700 border-zinc-600 text-white" />
                          <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" className="bg-zinc-700 border-zinc-600 text-white" />
                          <div className="flex gap-2">
                            <Button onClick={() => updateAgent(agent.id)} disabled={loading} size="sm" className="bg-blue-600 text-white hover:bg-blue-700">Guardar</Button>
                            <Button onClick={() => setEditingId(null)} variant="outline" size="sm" className="border-zinc-600 text-gray-300">Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="font-semibold text-white">{agent.name}</span>
                            <span className="ml-3 text-sm text-gray-400">NIT: {agent.nit}</span>
                            {PROTECTED_NITS.includes(agent.nit) && <span className="ml-2 px-2 py-0.5 bg-red-600 text-xs rounded-full">ADMIN</span>}
                          </div>
                          <div className="flex gap-2">
                            {!PROTECTED_NITS.includes(agent.nit) && (
                              <>
                                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setEditingId(agent.id); setEditName(agent.name); setEditPassword(""); }}>Editar</Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteAgent(agent.id, agent.name)}>Eliminar</Button>
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
          </div>
        )}

        {/* RECORDS TAB */}
        {tab === "records" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-3">Filtros</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                <div>
                  <Label className="text-gray-400">Módulo</Label>
                  <select value={filterModule} onChange={e => { setFilterModule(e.target.value); setFilterSubmodule(""); }} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
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
                  <Label className="text-gray-400">Submódulo</Label>
                  <select value={filterSubmodule} onChange={e => setFilterSubmodule(e.target.value)} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                    <option value="">Todos</option>
                    {submoduleOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-gray-400">Agente</Label>
                  <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                    <option value="">Todos</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-gray-400">Desde</Label>
                  <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-400">Hasta</Label>
                  <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-400">Buscar CS/INC/OT</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="bg-zinc-800 border-zinc-700 text-white pl-8 text-sm" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadRecords} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">Buscar</Button>
                  <Button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white text-sm">Exportar</Button>
                </div>
              </div>
            </div>

            {/* Delete by date range */}
            {deleteMode && (
              <div className="bg-red-900/30 p-4 rounded-xl border border-red-800 flex items-end gap-3 flex-wrap">
                <div>
                  <Label className="text-red-400">Eliminar desde</Label>
                  <Input type="date" value={deleteDateFrom} onChange={e => setDeleteDateFrom(e.target.value)} className="bg-zinc-800 border-red-700 text-white text-sm" />
                </div>
                <div>
                  <Label className="text-red-400">Eliminar hasta</Label>
                  <Input type="date" value={deleteDateTo} onChange={e => setDeleteDateTo(e.target.value)} className="bg-zinc-800 border-red-700 text-white text-sm" />
                </div>
                <Button onClick={deleteRecordsByDate} variant="destructive" className="text-sm">🗑️ Eliminar por rango</Button>
              </div>
            )}

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h2 className="text-lg font-semibold mb-3">Registros ({filteredRecords.length})</h2>
              <div className={scrollClass} style={scrollStyle}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900 z-10">
                    <tr className="border-b border-zinc-700">
                      <th className="text-left p-2 text-gray-400 text-xs">FECHA</th>
                      <th className="text-left p-2 text-gray-400 text-xs">AGENTE</th>
                      <th className="text-left p-2 text-gray-400 text-xs">MÓDULO</th>
                      <th className="text-left p-2 text-gray-400 text-xs">TIPO</th>
                      <th className="text-left p-2 text-gray-400 text-xs min-w-[110px]">ID</th>
                      <th className="text-left p-2 text-gray-400 text-xs">INCIDENCIA</th>
                      <th className="text-left p-2 text-gray-400 text-xs">OT</th>
                      <th className="text-left p-2 text-gray-400 text-xs">CS</th>
                      <th className="text-left p-2 text-gray-400 text-xs">FALLA</th>
                      <th className="text-left p-2 text-gray-400 text-xs">OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => (
                      <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="p-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("es-CO")}</td>
                        <td className="p-2 text-xs">{r.agents?.name || "N/A"}</td>
                        <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${moduleColor(r.module)}`}>{r.module}</span></td>
                        <td className="p-2 text-xs">{r.template_type || "N/A"}</td>
                        <td className="p-2 text-xs font-mono min-w-[110px]" title={r.id_mostrado || ""}>{r.id_mostrado || "—"}</td>
                        <td className="p-2 text-xs font-mono text-cyan-400">{r.incidencia || "—"}</td>
                        <td className="p-2 text-xs font-mono text-cyan-400">{r.ot || "—"}</td>
                        <td className="p-2 text-xs font-mono text-cyan-400">{getEffectiveCs(r) || "—"}</td>
                        <td className="p-2 text-xs">{r.tipo_falla || "—"}</td>
                        <td className="p-2 flex items-center gap-1">
                          {r.observation ? (
                            <button onClick={() => setViewingObs(r.observation)} className="text-blue-400 hover:text-blue-300" title="Ver plantilla">
                              <Eye className="h-4 w-4" />
                            </button>
                          ) : <span className="text-gray-600">—</span>}
                          {deleteMode && (
                            <button onClick={() => deleteRecord(r.id)} className="text-red-400 hover:text-red-300 ml-1" title="Eliminar registro">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRecords.length === 0 && <p className="text-gray-500 text-center py-6">No hay registros</p>}
            </div>
          </div>
        )}

        {/* IPS TAB */}
        {tab === "ips" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">📋 Base de IPs ({filteredIps.length})</h2>
                <div className="flex gap-2">
                  <Input value={ipSearch} onChange={e => setIpSearch(e.target.value)} placeholder="Buscar IP, OLT, localidad..." className="bg-zinc-800 border-zinc-700 text-white w-64 text-sm" />
                  <Button onClick={() => setShowAddIp(!showAddIp)} className="bg-green-600 text-white hover:bg-green-700 text-sm">{showAddIp ? "Cancelar" : "Agregar IP"}</Button>
                </div>
              </div>

              {showAddIp && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 p-3 bg-zinc-800 rounded-lg">
                  <Input value={newIp.ip} onChange={e => setNewIp({ ...newIp, ip: e.target.value })} placeholder="IP" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.olt} onChange={e => setNewIp({ ...newIp, olt: e.target.value })} placeholder="OLT" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.localidad} onChange={e => setNewIp({ ...newIp, localidad: e.target.value })} placeholder="Localidad" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.coinversor} onChange={e => setNewIp({ ...newIp, coinversor: e.target.value })} placeholder="Coinversor" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.tecnologia} onChange={e => setNewIp({ ...newIp, tecnologia: e.target.value })} placeholder="Tecnología" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.grupo_trabajo} onChange={e => setNewIp({ ...newIp, grupo_trabajo: e.target.value })} placeholder="Grupo Trabajo" className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Input value={newIp.articulo_config} onChange={e => setNewIp({ ...newIp, articulo_config: e.target.value })} placeholder="Art. Config." className="bg-zinc-700 border-zinc-600 text-white text-sm" />
                  <Button onClick={addIp} className="bg-blue-600 text-white hover:bg-blue-700 text-sm">Guardar</Button>
                </div>
              )}

              <div className={scrollClass} style={scrollStyle}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900 z-10">
                    <tr className="border-b border-zinc-700">
                      <th className="text-left p-2 text-gray-400 text-xs">IP</th>
                      <th className="text-left p-2 text-gray-400 text-xs">OLT</th>
                      <th className="text-left p-2 text-gray-400 text-xs">LOCALIDAD</th>
                      <th className="text-left p-2 text-gray-400 text-xs">COINVERSOR</th>
                      <th className="text-left p-2 text-gray-400 text-xs">TECNOLOGÍA</th>
                      <th className="text-left p-2 text-gray-400 text-xs">GRUPO</th>
                      <th className="text-left p-2 text-gray-400 text-xs">ART. CONFIG.</th>
                      <th className="text-left p-2 text-gray-400 text-xs">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIps.map(ip => (
                      <tr key={ip.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        {editingIpId === ip.id ? (
                          <>
                            <td className="p-1"><Input value={editIpData.ip || ""} onChange={e => setEditIpData({ ...editIpData, ip: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.olt || ""} onChange={e => setEditIpData({ ...editIpData, olt: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.localidad || ""} onChange={e => setEditIpData({ ...editIpData, localidad: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.coinversor || ""} onChange={e => setEditIpData({ ...editIpData, coinversor: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.tecnologia || ""} onChange={e => setEditIpData({ ...editIpData, tecnologia: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.grupo_trabajo || ""} onChange={e => setEditIpData({ ...editIpData, grupo_trabajo: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1"><Input value={editIpData.articulo_config || ""} onChange={e => setEditIpData({ ...editIpData, articulo_config: e.target.value })} className="bg-zinc-700 border-zinc-600 text-white text-xs h-8" /></td>
                            <td className="p-1 flex gap-1">
                              <Button size="sm" onClick={() => saveIpEdit(ip.id)} className="bg-green-600 text-white hover:bg-green-700 text-xs h-8">✓</Button>
                              <Button size="sm" onClick={() => setEditingIpId(null)} className="bg-zinc-600 text-white hover:bg-zinc-500 text-xs h-8">✕</Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2 text-xs font-mono text-cyan-400 font-semibold">{ip.ip}</td>
                            <td className="p-2 text-xs">{ip.olt}</td>
                            <td className="p-2 text-xs">{ip.localidad}</td>
                            <td className="p-2 text-xs"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${ip.coinversor === "ONNET" ? "bg-blue-600/20 text-blue-400" : ip.coinversor === "ONNET MAXIMO" ? "bg-green-600/20 text-green-400" : "bg-orange-600/20 text-orange-400"}`}>{ip.coinversor}</span></td>
                            <td className="p-2 text-xs">{ip.tecnologia}</td>
                            <td className="p-2 text-xs">{ip.grupo_trabajo}</td>
                            <td className="p-2 text-xs">{ip.articulo_config}</td>
                            <td className="p-2 flex gap-1">
                              <Button size="sm" onClick={() => { setEditingIpId(ip.id); setEditIpData(ip); }} className="bg-blue-600 text-white hover:bg-blue-700 text-xs h-7">Editar</Button>
                              <Button size="sm" onClick={() => deleteIp(ip.id)} variant="destructive" className="text-xs h-7">✕</Button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredIps.length === 0 && <p className="text-gray-500 text-center py-6">No hay IPs registradas</p>}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Observation Modal */}
      {viewingObs && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setViewingObs(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingObs(null)} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            <h3 className="text-lg font-semibold mb-4 text-white">Plantilla del Registro</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono bg-zinc-800 p-4 rounded-lg">{viewingObs}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

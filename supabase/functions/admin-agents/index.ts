import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INVALID_SERVICE_NOW_VALUES = new Set(["", "-", "N/A", "S/N", "SIN DATO", "NULL", "UNDEFINED"]);

const isServiceNowModule = (module?: string | null) => {
  const normalized = String(module || "").trim().toUpperCase();
  return normalized === "SERVICE NOW" || normalized === "SERVICE_NOW";
};

const normalizeServiceNowValue = (value?: string | null) => {
  const cleaned = String(value || "").trim();
  return INVALID_SERVICE_NOW_VALUES.has(cleaned.toUpperCase()) ? "" : cleaned;
};

const extractServiceNowFromObservation = (observation?: string | null) => {
  const match = String(observation || "").match(/SERVICE NOW\s*:\s*([^\n\r]+)/i);
  return normalizeServiceNowValue(match?.[1] || "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // Allow init-admin without auth
  if (action === "init-admin") {
    try {
      const email = "admincope@agent.cope.local";
      const password = "cope2026+-*";

      const { data: existing } = await supabaseAdmin.from("agents").select("id").eq("nit", "admincope").maybeSingle();
      if (existing?.id) {
        await supabaseAdmin.from("user_roles").upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
        return new Response(JSON.stringify({ success: true, message: "Admin ya existe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;
      await supabaseAdmin.from("agents").insert({ id: userId, nit: "admincope", name: "ADMINISTRADOR" });
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });

      return new Response(JSON.stringify({ success: true, message: "Admin creado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Seed additional admin agent without auth
  if (action === "seed-admin-agent") {
    try {
      const { nit: seedNit, name: seedName, password: seedPass } = body;
      if (!seedNit || !seedName || !seedPass) {
        return new Response(JSON.stringify({ error: "nit, name, password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const normalizedNit = String(seedNit).trim().toLowerCase();
      const normalizedName = String(seedName).trim();
      const normalizedPassword = String(seedPass);
      const seedEmail = `${normalizedNit}@agent.cope.local`;
      const { data: existingSeed } = await supabaseAdmin.from("agents").select("id").eq("nit", normalizedNit).maybeSingle();
      if (existingSeed?.id) {
        await supabaseAdmin.from("agents").update({ nit: normalizedNit, name: normalizedName }).eq("id", existingSeed.id);
        const { error: updateExistingUserError } = await supabaseAdmin.auth.admin.updateUserById(existingSeed.id, {
          email: seedEmail,
          password: normalizedPassword,
          email_confirm: true,
        });
        if (updateExistingUserError) throw updateExistingUserError;
        await supabaseAdmin.from("user_roles").upsert({ user_id: existingSeed.id, role: "admin" }, { onConflict: "user_id,role" });
        return new Response(JSON.stringify({ success: true, message: "Agent already exists, admin role ensured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: seedAuth, error: seedAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: seedEmail, password: normalizedPassword, email_confirm: true,
      });
      if (seedAuthErr) throw seedAuthErr;
      const seedUserId = seedAuth.user.id;
      await supabaseAdmin.from("agents").insert({ id: seedUserId, nit: normalizedNit, name: normalizedName });
      await supabaseAdmin.from("user_roles").insert({ user_id: seedUserId, role: "admin" });
      return new Response(JSON.stringify({ success: true, message: "Admin agent created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Verify caller is admin for all other actions
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!anonKey) {
    return new Response(JSON.stringify({ error: "Configuración incompleta del backend" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    if (action === "create") {
      const nit = String(body.nit || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const password = String(body.password || "").trim();

      if (!nit || !name || !password) {
        return new Response(JSON.stringify({ error: "NIT, nombre y contraseña son obligatorios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingAgent } = await supabaseAdmin.from("agents").select("id").eq("nit", nit).maybeSingle();
      if (existingAgent) {
        return new Response(JSON.stringify({ error: "Ya existe un agente con ese NIT" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = `${nit}@agent.cope.local`;

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      // Create agent profile
      const { error: agentError } = await supabaseAdmin.from("agents").insert({ id: userId, nit, name });
      if (agentError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw agentError;
      }

      // Assign agent role
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "agent" });
      if (roleError) {
        await supabaseAdmin.from("agents").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw roleError;
      }

      return new Response(JSON.stringify({ success: true, agent: { id: userId, nit, name } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { id, name, password } = body;

      if (name) {
        const { error } = await supabaseAdmin.from("agents").update({ name }).eq("id", id);
        if (error) throw error;
      }

      if (password) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = body;
      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("agents").delete().eq("id", id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabaseAdmin.from("agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      return new Response(JSON.stringify({ agents: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // init-admin handled above

    if (action === "export-records") {
      const { agent_id, module, template_type } = body;

      // Batch fetch all records to bypass the 1000-row default limit
      const BATCH_SIZE = 1000;
      let allRecords: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabaseAdmin
          .from("records")
          .select("id, agent_id, module, template_type, id_mostrado, tipo_falla, observation, incidencia, ot, cs, created_at")
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);
        if (agent_id) query = query.eq("agent_id", agent_id);
        if (module) query = query.eq("module", module);
        if (template_type) query = query.eq("template_type", template_type);

        const { data: batch, error } = await query;
        if (error) throw error;

        const rows = batch || [];
        allRecords = allRecords.concat(rows);
        hasMore = rows.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      const rawRecords = allRecords;

      const agentIds = [...new Set((rawRecords || []).map((record) => record.agent_id).filter(Boolean))];
      let agentMap = new Map();

      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabaseAdmin
          .from("agents")
          .select("id, name, nit")
          .in("id", agentIds);

        if (agentsError) throw agentsError;
        agentMap = new Map((agentsData || []).map((agent) => [agent.id, { name: agent.name, nit: agent.nit }]));
      }

      const records = (rawRecords || []).map((record) => {
        const normalizedCs = isServiceNowModule(record.module)
          ? normalizeServiceNowValue(record.cs) || normalizeServiceNowValue(record.id_mostrado) || extractServiceNowFromObservation(record.observation)
          : record.cs;

        const normalizedId = isServiceNowModule(record.module)
          ? normalizeServiceNowValue(record.id_mostrado) || normalizedCs || null
          : record.id_mostrado;

        return {
          ...record,
          id_mostrado: normalizedId,
          cs: normalizedCs || null,
          agents: agentMap.get(record.agent_id) || null,
        };
      });

      return new Response(JSON.stringify({ records }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

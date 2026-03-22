import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
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

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "create") {
      const { nit, name, password } = body;
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
      if (roleError) throw roleError;

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

    if (action === "init-admin") {
      // One-time admin setup
      const email = "admincope@agent.cope.local";
      const password = "cope2026+-*";

      // Check if admin exists
      const { data: existing } = await supabaseAdmin.from("agents").select("id").eq("nit", "admincope").maybeSingle();
      if (existing) {
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
    }

    if (action === "export-records") {
      const { agent_id, module } = body;
      let query = supabaseAdmin.from("records").select("*, agents(name, nit)").order("created_at", { ascending: false });
      if (agent_id) query = query.eq("agent_id", agent_id);
      if (module) query = query.eq("module", module);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ records: data }), {
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

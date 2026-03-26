import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const [nit, setNit] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Init admin without auth header
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-agents`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: "init-admin" }),
    }).catch(() => {});

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const [{ data: agent }, { data: role }] = await Promise.all([
        supabase.from("agents").select("id").eq("id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
      ]);

      if (agent || role) {
        navigate("/app");
      } else {
        await supabase.auth.signOut();
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nit.trim() || !password.trim()) {
      toast.error("Ingrese NIT y contraseña");
      return;
    }

    setLoading(true);
    try {
      const email = `${nit.trim()}@agent.cope.local`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error("NIT o contraseña incorrectos");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        await supabase.auth.signOut();
        toast.error("No fue posible validar el acceso");
        return;
      }

      const [{ data: agent }, { data: role }] = await Promise.all([
        supabase.from("agents").select("id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (!agent && !role) {
        await supabase.auth.signOut();
        toast.error("Usuario no registrado en la plataforma");
        return;
      }

      navigate("/app");
    } catch {
      toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            GENERADOR DE PLANTILLAS
          </h1>
          <p className="mt-2 text-sm text-gray-400">Ingrese sus credenciales para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 bg-zinc-900 p-8 rounded-xl border border-zinc-800">
          <div className="space-y-2">
            <Label htmlFor="nit" className="text-gray-300">NIT / Usuario</Label>
            <Input
              id="nit"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              placeholder="Ingrese su NIT"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {loading ? "Ingresando..." : "INGRESAR"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;

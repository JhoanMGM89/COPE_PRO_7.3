import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Login = () => {
  const [nit, setNit] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Init admin on first load
    supabase.functions.invoke("admin-agents", { body: { action: "init-admin" } }).catch(() => {});
    
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/app");
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

      toast.success("Bienvenido");
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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
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

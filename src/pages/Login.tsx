import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuthReady } from "@/hooks/use-auth-ready";

const Login = () => {
  const [nit, setNit] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [btnText, setBtnText] = useState("Ingresar");
  const linesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isReady, session } = useAuthReady();

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-agents`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "init-admin" }),
    }).catch(() => {});

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "seed-admin-agent", nit: "1143330990", name: "JHOAN GORDON", password: "Bysamael89+++" }),
    }).catch(() => {});

    createLines();
  }, []);

  useEffect(() => {
    if (!isReady || !session) return;

    const validateExistingSession = async () => {
      const userId = session.user.id;
      const [{ data: agent }, { data: role }] = await Promise.all([
        supabase.from("agents").select("id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (agent || role) navigate("/app");
      else await supabase.auth.signOut();
    };

    validateExistingSession();
  }, [isReady, session, navigate]);

  const createLines = () => {
    const container = linesRef.current;
    if (!container || container.childElementCount > 0) return;

    for (let i = 0; i < 25; i++) {
      const line = document.createElement("div");
      line.className = "login-line login-line-tl";
      line.style.top = `${(i / 25) * 100}%`;
      line.style.left = "-10%";
      line.style.width = "120%";
      const angle = 25 + Math.random() * 20;
      line.style.setProperty("--angle", `${angle}deg`);
      line.style.animation = `flowThroughLeft ${4 + Math.random() * 2}s ease-in-out infinite`;
      line.style.animationDelay = `${i * 0.15}s`;
      line.style.height = `${1 + Math.random() * 2}px`;
      container.appendChild(line);
    }

    for (let i = 0; i < 25; i++) {
      const line = document.createElement("div");
      line.className = "login-line login-line-tr";
      line.style.top = `${(i / 25) * 100}%`;
      line.style.right = "-10%";
      line.style.width = "120%";
      const angle = -25 - Math.random() * 20;
      line.style.setProperty("--angle", `${angle}deg`);
      line.style.animation = `flowThroughRight ${4 + Math.random() * 2}s ease-in-out infinite`;
      line.style.animationDelay = `${i * 0.15}s`;
      line.style.height = `${1 + Math.random() * 2}px`;
      container.appendChild(line);
    }

    for (let i = 0; i < 60; i++) {
      const p = document.createElement("div");
      p.className = "login-particle";
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty("--drift", `${(Math.random() - 0.5) * 100}px`);
      p.style.animationDelay = `${Math.random() * 5}s`;
      p.style.animationDuration = `${4 + Math.random() * 3}s`;
      const size = 2 + Math.random() * 2;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      container.appendChild(p);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nit.trim() || !password.trim()) { toast.error("Ingrese NIT y contraseña"); return; }
    setLoading(true);
    setBtnText("Verificando...");

    try {
      const email = `${nit.trim()}@agent.cope.local`;
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error("NIT o contraseña incorrectos"); setBtnText("Ingresar"); return; }

      const userId = signInData.user?.id;
      if (!userId) {
        await supabase.auth.signOut();
        toast.error("No fue posible validar el acceso");
        setBtnText("Ingresar");
        return;
      }

      const [{ data: agent }, { data: role }] = await Promise.all([
        supabase.from("agents").select("id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (!agent && !role) {
        await supabase.auth.signOut();
        toast.error("Usuario no registrado en la plataforma");
        setBtnText("Ingresar");
        return;
      }

      setBtnText("✓ Acceso Concedido");
      navigate("/app");
    } catch {
      toast.error("Error al iniciar sesión");
      setBtnText("Ingresar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-animated-bg">
      <div ref={linesRef} className="login-lines-container" />
      <div className="login-center-glow" />
      <div className="login-card">
        <h1 className="login-title">Generador de Plantilla</h1>
        <p className="login-subtitle">Sistema de Acceso</p>
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-input-group">
            <input
              type="text" value={nit} onChange={e => setNit(e.target.value)}
              placeholder="NIT / Usuario" autoFocus className="login-input"
            />
          </div>
          <div className="login-input-group" style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
              className="login-input" style={{ paddingRight: 48 }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(0,200,255,0.6)", cursor: "pointer", padding: 4 }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="submit" disabled={loading || !isReady} className="login-btn"
            style={btnText.includes("✓") ? { background: "linear-gradient(135deg, #00ff88, #00cc66)" } : {}}>
            {!isReady ? "Cargando..." : btnText}
          </button>
        </form>
        <div className="login-footer">v2.0.4 · By Jhoan_Gordon</div>
      </div>
    </div>
  );
};

export default Login;

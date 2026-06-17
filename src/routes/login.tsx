import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, isAuthed, isCurrentUserAdmin, logout } from "../lib/admin-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — ProductLab CRM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Já logado? vai direto pro painel.
  useEffect(() => {
    let active = true;
    isAuthed().then((authed) => {
      if (active && authed) navigate({ to: "/admin" });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { ok, error: err } = await login(email, password);
    if (ok) {
      // Login válido, mas o painel é só pra administradores.
      if (await isCurrentUserAdmin()) {
        navigate({ to: "/admin" });
      } else {
        await logout();
        setError("Acesso restrito a administradores.");
        setLoading(false);
      }
    } else {
      setError(err === "Invalid login credentials" ? "Email ou senha inválidos." : (err ?? "Falha ao entrar."));
      setLoading(false);
    }
  };

  return (
    <div className="crm-login">
      <div className="hero-glow hero-glow-1" aria-hidden="true"></div>
      <div className="hero-glow hero-glow-2" aria-hidden="true"></div>

      <form className="crm-login-card" onSubmit={onSubmit} noValidate>
        <div className="crm-brand crm-brand-lg">
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="plOrbitGradLogin"
                x1="6"
                y1="6"
                x2="58"
                y2="58"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#A855F7" />
                <stop offset="0.5" stopColor="#D14FBF" />
                <stop offset="1" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <circle
              cx="32"
              cy="32"
              r="19"
              fill="none"
              stroke="url(#plOrbitGradLogin)"
              strokeWidth="4.5"
              opacity="0.45"
            />
            <circle cx="32" cy="32" r="6.5" fill="url(#plOrbitGradLogin)" />
            <circle cx="32" cy="13" r="5.5" fill="url(#plOrbitGradLogin)" />
          </svg>
          <span className="crm-brand-name">ProductLab</span>
          <span className="crm-brand-tag">CRM</span>
        </div>

        <h1 className="crm-login-title">Entrar no painel</h1>
        <p className="crm-login-sub">Acesso restrito à equipe.</p>

        <label className="crm-field">
          <span className="crm-field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="crm-field">
          <span className="crm-field-label">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="crm-login-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
          {loading ? "Entrando..." : "Entrar →"}
        </button>

        <Link to="/" className="crm-login-back">
          ← Voltar pro site
        </Link>
      </form>
    </div>
  );
}

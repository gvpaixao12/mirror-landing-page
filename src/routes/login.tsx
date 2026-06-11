import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, isAuthed } from "../lib/admin-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — GSolutions CRM" }, { name: "robots", content: "noindex, nofollow" }],
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
      navigate({ to: "/admin" });
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
          <span className="crm-brand-dot"></span>
          <span className="crm-brand-name">GSolutions</span>
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
            placeholder="voce@gsolutions.local"
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

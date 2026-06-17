import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { createForm } from "../lib/crm-data";

export const Route = createFileRoute("/briefing")({
  head: () => ({
    meta: [
      { title: "Briefing — ProductLab" },
      {
        name: "description",
        content:
          "Conte sobre o software que você quer construir. Quanto mais detalhe, melhor a proposta.",
      },
      { property: "og:title", content: "Briefing — ProductLab" },
      {
        property: "og:description",
        content: "Envie seu briefing e receba uma proposta sob medida em até 72h.",
      },
    ],
  }),
  component: BriefingPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().min(2, "Informe cidade / estado").max(120),
  role: z.string().trim().min(2, "Conte com o que você trabalha").max(160),
  industry: z.string().trim().min(2, "Informe o setor").max(120),
  teamSize: z.string().min(1, "Selecione um tamanho de time"),
  goal: z.string().trim().min(20, "Descreva o objetivo com mais detalhe").max(2000),
  problem: z.string().trim().min(20, "Conte o problema atual").max(2000),
  tools: z.string().trim().max(500).optional().or(z.literal("")),
  budget: z.string().min(1, "Selecione uma faixa"),
  timeline: z.string().min(1, "Selecione um prazo"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

const initial: FormState = {
  name: "",
  email: "",
  company: "",
  location: "",
  role: "",
  industry: "",
  teamSize: "",
  goal: "",
  problem: "",
  tools: "",
  budget: "",
  timeline: "",
  notes: "",
};

function BriefingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setData((d) => ({ ...d, [k]: e.target.value }));
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError("");
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      if (firstKey)
        document
          .getElementById(`f-${firstKey}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await createForm({
        name: data.name,
        email: data.email,
        company: data.company || "",
        message: data.goal,
        payload: { ...data },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSendError(
        err instanceof Error
          ? `Não foi possível enviar: ${err.message}`
          : "Não foi possível enviar. Tente novamente.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="briefing-page">
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient
                    id="plOrbitGrad"
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
                  stroke="url(#plOrbitGrad)"
                  strokeWidth="4.5"
                  opacity="0.45"
                />
                <circle cx="32" cy="32" r="6.5" fill="url(#plOrbitGrad)" />
                <g>
                  <circle cx="32" cy="13" r="5.5" fill="url(#plOrbitGrad)" />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 32 32"
                    to="360 32 32"
                    dur="7s"
                    repeatCount="indefinite"
                  />
                </g>
              </svg>
            </span>
            <span className="brand-name">ProductLab</span>
          </Link>
        </div>
      </header>

      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="hero-glow hero-glow-1" aria-hidden="true"></div>
        <div className="hero-glow hero-glow-2" aria-hidden="true"></div>
        <div className="container" style={{ position: "relative", zIndex: 2, maxWidth: 880 }}>
          <span className="pill">
            <span className="pill-dot"></span>briefing · 5 minutos
          </span>
          <h1 className="hero-title" style={{ fontSize: "clamp(36px, 5.5vw, 64px)" }}>
            Conta tudo sobre <em className="grad-text">seu projeto.</em>
          </h1>
          <p className="hero-sub">
            Quanto mais detalhe você der, mais precisa fica a proposta. Levamos até 72h pra
            responder com escopo, prazo e preço fechado.
          </p>
        </div>
      </section>

      <section style={{ padding: "clamp(40px, 6vw, 72px) 0 var(--section-y)" }}>
        <div className="container" style={{ maxWidth: 880 }}>
          {submitted ? (
            <div className="brief-success">
              <span
                className="check-badge"
                style={{ width: 44, height: 44, fontSize: 20, borderRadius: 12 }}
              >
                ✓
              </span>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", marginTop: 18 }}>
                Briefing recebido!
              </h2>
              <p style={{ color: "var(--dim)", marginTop: 12, fontSize: 16 }}>
                Obrigado, <strong style={{ color: "var(--ink)" }}>{data.name.split(" ")[0]}</strong>
                . Vamos analisar e responder no seu email{" "}
                <strong style={{ color: "var(--ink)" }}>{data.email}</strong> em até 72h.
              </p>
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link to="/" className="btn btn-primary">
                  Voltar pra home
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setData(initial);
                    setSubmitted(false);
                  }}
                >
                  Enviar outro briefing
                </button>
              </div>
            </div>
          ) : (
            <form className="brief-form" onSubmit={onSubmit} noValidate>
              <FieldGroup title="Sobre você">
                <Field id="name" label="Nome completo" error={errors.name}>
                  <input
                    id="f-name"
                    type="text"
                    value={data.name}
                    onChange={set("name")}
                    maxLength={100}
                    placeholder="SEU NOME"
                  />
                </Field>
                <Field id="email" label="Email" error={errors.email}>
                  <input
                    id="f-email"
                    type="email"
                    value={data.email}
                    onChange={set("email")}
                    maxLength={255}
                    placeholder="voce@empresa.com"
                  />
                </Field>
                <Field id="company" label="Empresa (opcional)" error={errors.company}>
                  <input
                    id="f-company"
                    type="text"
                    value={data.company}
                    onChange={set("company")}
                    maxLength={120}
                    placeholder="Distribuidora XYZ"
                  />
                </Field>
                <Field id="location" label="Cidade / Estado" error={errors.location}>
                  <input
                    id="f-location"
                    type="text"
                    value={data.location}
                    onChange={set("location")}
                    maxLength={120}
                    placeholder="São Paulo, SP"
                  />
                </Field>
                <Field id="role" label="Com o que você trabalha?" error={errors.role}>
                  <input
                    id="f-role"
                    type="text"
                    value={data.role}
                    onChange={set("role")}
                    maxLength={160}
                    placeholder="Ex.: COO, dono de operação logística"
                  />
                </Field>
                <Field id="industry" label="Setor" error={errors.industry}>
                  <input
                    id="f-industry"
                    type="text"
                    value={data.industry}
                    onChange={set("industry")}
                    maxLength={120}
                    placeholder="Ex.: distribuição, saúde, educação"
                  />
                </Field>
                <Field id="teamSize" label="Tamanho do time" error={errors.teamSize}>
                  <select id="f-teamSize" value={data.teamSize} onChange={set("teamSize")}>
                    <option value="">Selecione...</option>
                    <option>Só eu</option>
                    <option>2 – 10</option>
                    <option>11 – 50</option>
                    <option>51 – 200</option>
                    <option>200+</option>
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup title="Sobre o projeto">
                <Field
                  id="problem"
                  label="Qual o problema atual / como vocês resolvem hoje?"
                  error={errors.problem}
                  full
                >
                  <textarea
                    id="f-problem"
                    rows={4}
                    value={data.problem}
                    onChange={set("problem")}
                    maxLength={2000}
                    placeholder="Ex.: Hoje rodamos em 14 planilhas, cada gerente atualiza a sua, e o fechamento demora 5 dias."
                  />
                </Field>
                <Field id="goal" label="Qual o objetivo do software?" error={errors.goal} full>
                  <textarea
                    id="f-goal"
                    rows={4}
                    value={data.goal}
                    onChange={set("goal")}
                    maxLength={2000}
                    placeholder="Ex.: Quero um portal pros representantes verem comissão em tempo real e exportarem relatórios."
                  />
                </Field>
                <Field
                  id="tools"
                  label="Ferramentas / sistemas que precisam conversar (opcional)"
                  error={errors.tools}
                  full
                >
                  <input
                    id="f-tools"
                    type="text"
                    value={data.tools}
                    onChange={set("tools")}
                    maxLength={500}
                    placeholder=""
                  />
                </Field>
                <Field id="budget" label="Faixa de investimento" error={errors.budget}>
                  <select id="f-budget" value={data.budget} onChange={set("budget")}>
                    <option value="">Selecione...</option>
                    <option>Até R$ 5k</option>
                    <option>Até R$ 10k</option>
                    <option>R$ 10k – R$ 20k</option>
                    <option>R$ 50k+</option>
                    <option>Ainda não sei</option>
                  </select>
                </Field>
                <Field id="timeline" label="Prazo ideal" error={errors.timeline}>
                  <select id="f-timeline" value={data.timeline} onChange={set("timeline")}>
                    <option value="">Selecione...</option>
                    <option>Em 1 mês</option>
                    <option>Em 2 – 3 meses</option>
                    <option>Em 1 ano</option>
                    <option>Sem pressa</option>
                  </select>
                </Field>
                <Field
                  id="notes"
                  label="Algo mais que a gente precisa saber? (opcional)"
                  error={errors.notes}
                  full
                >
                  <textarea
                    id="f-notes"
                    rows={3}
                    value={data.notes}
                    onChange={set("notes")}
                    maxLength={2000}
                    placeholder="Links de referência, restrições, regras de negócio..."
                  />
                </Field>
              </FieldGroup>

              {sendError && <div className="crm-login-error">{sendError}</div>}

              <div className="brief-actions">
                <button type="submit" className="btn btn-primary btn-large" disabled={sending}>
                  {sending ? "Enviando..." : "Enviar briefing →"}
                </button>
                <Link to="/" className="btn btn-secondary">
                  Cancelar
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand">✦ ProductLab</div>
            <p>Seu software do jeito que você sempre pensou.</p>
          </div>
          <div className="footer-links">
            <span>Brasil</span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="brief-group">
      <h3 className="brief-group-title">{title}</h3>
      <div className="brief-grid">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  full,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={`f-${id}`}
      className={"brief-field" + (full ? " brief-field-full" : "") + (error ? " has-error" : "")}
    >
      <span className="brief-label">{label}</span>
      {children}
      {error && <span className="brief-error">{error}</span>}
    </label>
  );
}

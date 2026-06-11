import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSession, isAuthed, logout } from "../lib/admin-auth";
import {
  STAGES,
  type Stage,
  leads,
  forms,
  getSummary,
  getFunnel,
  formatBRL,
  formatDate,
} from "../lib/crm-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ProductLab CRM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type View = "dashboard" | "kanban" | "leads" | "clientes" | "propostas" | "formularios";

const NAV: { key: View; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "kanban", label: "Kanban", icon: "▤" },
  { key: "leads", label: "Leads", icon: "◍" },
  { key: "clientes", label: "Clientes", icon: "◆" },
  { key: "propostas", label: "Propostas", icon: "≡" },
  { key: "formularios", label: "Formulários", icon: "✉" },
];

function AdminPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("dashboard");
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  // Proteção de rota: sem sessão → manda pro login.
  useEffect(() => {
    if (!isAuthed()) {
      navigate({ to: "/login" });
      return;
    }
    setEmail(getSession()?.email ?? "");
    setReady(true);
  }, [navigate]);

  const onLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  if (!ready) return null;

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <div className="crm-brand">
          <span className="crm-brand-dot"></span>
          <span className="crm-brand-name">ProductLab</span>
          <span className="crm-brand-tag">CRM</span>
        </div>

        <nav className="crm-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={"crm-nav-item" + (view === item.key ? " is-active" : "")}
              onClick={() => setView(item.key)}
            >
              <span className="crm-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="crm-user">
          <div className="crm-user-row">
            <span className="crm-avatar">{(email[0] || "A").toUpperCase()}</span>
            <div className="crm-user-info">
              <strong>{email || "admin@productlab.local"}</strong>
              <span>Admin</span>
            </div>
          </div>
          <button className="crm-logout" onClick={onLogout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="crm-main">
        {view === "dashboard" && <DashboardView />}
        {view === "kanban" && <KanbanView />}
        {view === "leads" && <LeadsView />}
        {view === "clientes" && <ClientesView />}
        {view === "propostas" && <PropostasView />}
        {view === "formularios" && <FormulariosView />}
      </main>
    </div>
  );
}

// ===================== Dashboard =====================

function DashboardView() {
  const s = getSummary();
  const funnel = getFunnel();
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <>
      <PageHead title="Dashboard" subtitle="Visão geral comercial em tempo real." />

      <div className="crm-stats">
        <StatCard label="Total de leads" value={s.totalLeads} hint="Cadastrados no CRM" />
        <StatCard label="Novos leads" value={s.newLeads} hint="Aguardando contato" />
        <StatCard label="Em negociação" value={s.inNegotiation} hint="Proposta + negociação" />
        <StatCard label="Formulários" value={s.forms} hint={`${s.newForms} novos`} />
        <StatCard label="Negócios fechados" value={s.closedDeals} hint="Status ganho" />
      </div>

      <div className="crm-stats crm-stats-3">
        <StatCard label="Valor estimado" value={formatBRL(s.estimatedValue)} hint="Soma do funil" />
        <StatCard label="Valor fechado" value={formatBRL(s.closedValue)} hint="Negócios ganhos" />
        <StatCard label="Conversão" value={`${s.conversion}%`} hint="Lead → Ganho" />
      </div>

      <div className="crm-panel">
        <h3 className="crm-panel-title">Funil de vendas</h3>
        <div className="crm-funnel">
          {funnel.map((f) => (
            <div className="crm-funnel-row" key={f.stage}>
              <span className="crm-funnel-label">{f.stage}</span>
              <div className="crm-funnel-track">
                <div
                  className="crm-funnel-fill"
                  style={{ width: `${(f.count / maxCount) * 100}%` }}
                ></div>
              </div>
              <span className="crm-funnel-count">{f.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ===================== Kanban =====================

function KanbanView() {
  return (
    <>
      <PageHead title="Kanban" subtitle="Arraste mentalmente — visão por etapa do funil." />
      <div className="crm-kanban">
        {STAGES.map((stage) => {
          const cards = leads.filter((l) => l.stage === stage);
          return (
            <div className="crm-kanban-col" key={stage}>
              <div className="crm-kanban-head">
                <span>{stage}</span>
                <span className="crm-badge">{cards.length}</span>
              </div>
              <div className="crm-kanban-body">
                {cards.length === 0 ? (
                  <p className="crm-empty-sm">—</p>
                ) : (
                  cards.map((l) => (
                    <div className="crm-card" key={l.id}>
                      <strong>{l.name}</strong>
                      <span>{l.company}</span>
                      <span className="crm-card-value">{formatBRL(l.value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===================== Leads =====================

function LeadsView() {
  return (
    <>
      <PageHead title="Leads" subtitle="Todos os contatos no funil." />
      <Table
        head={["Nome", "Empresa", "Email", "Etapa", "Valor", "Criado"]}
        rows={leads.map((l) => [
          l.name,
          l.company,
          l.email,
          <StageTag key={l.id} stage={l.stage} />,
          formatBRL(l.value),
          formatDate(l.createdAt),
        ])}
        empty="Nenhum lead cadastrado."
      />
    </>
  );
}

// ===================== Clientes =====================

function ClientesView() {
  const clientes = leads.filter((l) => l.stage === "Ganho");
  return (
    <>
      <PageHead title="Clientes" subtitle="Negócios já fechados (status ganho)." />
      <Table
        head={["Nome", "Empresa", "Email", "Valor", "Fechado em"]}
        rows={clientes.map((l) => [
          l.name,
          l.company,
          l.email,
          formatBRL(l.value),
          formatDate(l.createdAt),
        ])}
        empty="Ainda nenhum cliente fechado."
      />
    </>
  );
}

// ===================== Propostas =====================

function PropostasView() {
  const props = leads.filter((l) => l.stage === "Proposta" || l.stage === "Negociação");
  return (
    <>
      <PageHead title="Propostas" subtitle="Leads com proposta enviada ou em negociação." />
      <Table
        head={["Nome", "Empresa", "Etapa", "Valor", "Enviada"]}
        rows={props.map((l) => [
          l.name,
          l.company,
          <StageTag key={l.id} stage={l.stage} />,
          formatBRL(l.value),
          formatDate(l.createdAt),
        ])}
        empty="Nenhuma proposta em aberto."
      />
    </>
  );
}

// ===================== Formulários =====================

function FormulariosView() {
  return (
    <>
      <PageHead title="Formulários" subtitle="Mensagens recebidas pelo site." />
      <div className="crm-forms">
        {forms.length === 0 ? (
          <p className="crm-empty">Nenhum formulário recebido.</p>
        ) : (
          forms.map((f) => (
            <div className="crm-form-item" key={f.id}>
              <div className="crm-form-top">
                <strong>{f.name}</strong>
                {f.isNew && <span className="crm-badge crm-badge-new">novo</span>}
                <span className="crm-form-date">{formatDate(f.createdAt)}</span>
              </div>
              <a href={`mailto:${f.email}`} className="crm-form-email">
                {f.email}
              </a>
              <p className="crm-form-msg">{f.message}</p>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ===================== Reutilizáveis =====================

function PageHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="crm-pagehead">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="crm-stat">
      <span className="crm-stat-label">{label}</span>
      <strong className="crm-stat-value">{value}</strong>
      <span className="crm-stat-hint">{hint}</span>
    </div>
  );
}

function StageTag({ stage }: { stage: Stage }) {
  return <span className="crm-stage-tag">{stage}</span>;
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <p className="crm-empty">{empty}</p>;
  return (
    <div className="crm-panel crm-panel-flush">
      <table className="crm-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

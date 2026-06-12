import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentEmail, isAuthed, logout } from "../lib/admin-auth";
import {
  STAGES,
  type Stage,
  type Lead,
  type LeadInput,
  type FormEntry,
  type FormStatus,
  fetchLeads,
  fetchForms,
  createLead,
  updateLead,
  updateLeadStage,
  deleteLead,
  setFormStatus,
  deleteForm,
  convertFormToLead,
  getSummary,
  getFunnel,
  formatBRL,
  formatDate,
  BRIEFING_LABELS,
} from "../lib/crm-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "ProductLab CRM" }, { name: "robots", content: "noindex, nofollow" }],
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

  const [leads, setLeads] = useState<Lead[]>([]);
  const [forms, setForms] = useState<FormEntry[]>([]);
  const [loadError, setLoadError] = useState("");

  // Modais
  const [leadModal, setLeadModal] = useState<{ open: boolean; lead: Lead | null }>({
    open: false,
    lead: null,
  });
  const [viewingForm, setViewingForm] = useState<FormEntry | null>(null);

  // Proteção de rota + carga inicial dos dados.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!(await isAuthed())) {
        navigate({ to: "/login" });
        return;
      }
      if (!active) return;
      setEmail((await getCurrentEmail()) ?? "");
      try {
        const [ls, fs] = await Promise.all([fetchLeads(), fetchForms()]);
        if (!active) return;
        setLeads(ls);
        setForms(fs);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "Falha ao carregar dados.");
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  // ---- Leads ----
  const moveLead = async (id: string, stage: Stage) => {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      await updateLeadStage(id, stage);
    } catch {
      setLeads(prev);
    }
  };

  const saveLead = async (input: LeadInput) => {
    if (leadModal.lead) {
      await updateLead(leadModal.lead.id, input);
      setLeads((cur) => cur.map((l) => (l.id === leadModal.lead!.id ? { ...l, ...input } : l)));
    } else {
      const created = await createLead(input);
      setLeads((cur) => [...cur, created]);
    }
    setLeadModal({ open: false, lead: null });
  };

  const removeLead = async (id: string) => {
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    const prev = leads;
    setLeads((cur) => cur.filter((l) => l.id !== id));
    try {
      await deleteLead(id);
    } catch {
      setLeads(prev);
    }
  };

  // ---- Forms ----
  const archiveForm = async (id: string) => {
    const prev = forms;
    setForms((cur) => cur.map((f) => (f.id === id ? { ...f, status: "arquivado" } : f)));
    try {
      await setFormStatus(id, "arquivado");
    } catch {
      setForms(prev);
    }
  };

  const removeForm = async (id: string) => {
    if (!confirm("Excluir este formulário?")) return;
    const prev = forms;
    setForms((cur) => cur.filter((f) => f.id !== id));
    try {
      await deleteForm(id);
    } catch {
      setForms(prev);
    }
  };

  const convertForm = async (form: FormEntry) => {
    try {
      const lead = await convertFormToLead(form);
      setLeads((cur) => [...cur, lead]);
      setForms((cur) => cur.map((f) => (f.id === form.id ? { ...f, status: "convertido" } : f)));
      setViewingForm(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao converter.");
    }
  };

  const onLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  if (!ready) {
    return (
      <div className="crm-loading">{loadError ? `Erro: ${loadError}` : "Carregando..."}</div>
    );
  }

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
        {view === "dashboard" && <DashboardView leads={leads} forms={forms} />}
        {view === "kanban" && (
          <KanbanView
            leads={leads}
            moveLead={moveLead}
            onEdit={(l) => setLeadModal({ open: true, lead: l })}
            onDelete={removeLead}
            onNew={() => setLeadModal({ open: true, lead: null })}
          />
        )}
        {view === "leads" && (
          <LeadsView
            leads={leads}
            onEdit={(l) => setLeadModal({ open: true, lead: l })}
            onDelete={removeLead}
            onNew={() => setLeadModal({ open: true, lead: null })}
          />
        )}
        {view === "clientes" && (
          <ClientesView leads={leads} onEdit={(l) => setLeadModal({ open: true, lead: l })} onDelete={removeLead} />
        )}
        {view === "propostas" && (
          <PropostasView leads={leads} onEdit={(l) => setLeadModal({ open: true, lead: l })} onDelete={removeLead} />
        )}
        {view === "formularios" && (
          <FormulariosView
            forms={forms}
            onView={setViewingForm}
            onArchive={archiveForm}
            onDelete={removeForm}
          />
        )}
      </main>

      {leadModal.open && (
        <LeadModal
          lead={leadModal.lead}
          onClose={() => setLeadModal({ open: false, lead: null })}
          onSave={saveLead}
        />
      )}
      {viewingForm && (
        <FormView form={viewingForm} onClose={() => setViewingForm(null)} onConvert={convertForm} />
      )}
    </div>
  );
}

// ===================== Dashboard =====================

function DashboardView({ leads, forms }: { leads: Lead[]; forms: FormEntry[] }) {
  const s = getSummary(leads, forms);
  const funnel = getFunnel(leads);
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

// ===================== Kanban (drag & drop) =====================

function KanbanView({
  leads,
  moveLead,
  onEdit,
  onDelete,
  onNew,
}: {
  leads: Lead[];
  moveLead: (id: string, stage: Stage) => void;
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const onDrop = (stage: Stage) => {
    if (dragId) moveLead(dragId, stage);
    setDragId(null);
    setOverStage(null);
  };

  return (
    <>
      <PageHead title="Kanban" subtitle="Arraste os cards entre as etapas do funil." action={{ label: "+ Novo lead", onClick: onNew }} />
      <div className="crm-kanban">
        {STAGES.map((stage) => {
          const cards = leads.filter((l) => l.stage === stage);
          const isOver = overStage === stage;
          return (
            <div
              className={"crm-kanban-col" + (isOver ? " is-over" : "")}
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                if (overStage !== stage) setOverStage(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverStage((s) => (s === stage ? null : s));
                }
              }}
              onDrop={() => onDrop(stage)}
            >
              <div className="crm-kanban-head">
                <span>{stage}</span>
                <span className="crm-badge">{cards.length}</span>
              </div>
              <div className="crm-kanban-body">
                {cards.length === 0 ? (
                  <p className="crm-empty-sm">—</p>
                ) : (
                  cards.map((l) => (
                    <div
                      className={
                        "crm-card crm-card-draggable" + (dragId === l.id ? " is-dragging" : "")
                      }
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                    >
                      <div className="crm-card-top">
                        <strong>{l.name}</strong>
                        <div className="crm-card-actions">
                          <button title="Editar" onClick={() => onEdit(l)}>✎</button>
                          <button title="Excluir" onClick={() => onDelete(l.id)}>✕</button>
                        </div>
                      </div>
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

function LeadsView({
  leads,
  onEdit,
  onDelete,
  onNew,
}: {
  leads: Lead[];
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <>
      <PageHead
        title="Leads"
        subtitle="Todos os contatos no funil."
        action={{ label: "+ Novo lead", onClick: onNew }}
      />
      <Table
        head={["Nome", "Empresa", "Email", "Etapa", "Valor", "Criado", ""]}
        rows={leads.map((l) => [
          l.name,
          l.company,
          l.email,
          <StageTag key={l.id} stage={l.stage} />,
          formatBRL(l.value),
          formatDate(l.createdAt),
          <RowActions key={`a-${l.id}`} onEdit={() => onEdit(l)} onDelete={() => onDelete(l.id)} />,
        ])}
        empty="Nenhum lead cadastrado."
      />
    </>
  );
}

// ===================== Clientes =====================

function ClientesView({
  leads,
  onEdit,
  onDelete,
}: {
  leads: Lead[];
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
}) {
  const clientes = leads.filter((l) => l.stage === "Ganho");
  return (
    <>
      <PageHead title="Clientes" subtitle="Negócios já fechados (status ganho)." />
      <Table
        head={["Nome", "Empresa", "Email", "Valor", "Fechado em", ""]}
        rows={clientes.map((l) => [
          l.name,
          l.company,
          l.email,
          formatBRL(l.value),
          formatDate(l.createdAt),
          <RowActions key={`a-${l.id}`} onEdit={() => onEdit(l)} onDelete={() => onDelete(l.id)} />,
        ])}
        empty="Ainda nenhum cliente fechado."
      />
    </>
  );
}

// ===================== Propostas =====================

function PropostasView({
  leads,
  onEdit,
  onDelete,
}: {
  leads: Lead[];
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
}) {
  const props = leads.filter((l) => l.stage === "Proposta" || l.stage === "Negociação");
  return (
    <>
      <PageHead title="Propostas" subtitle="Leads com proposta enviada ou em negociação." />
      <Table
        head={["Nome", "Empresa", "Etapa", "Valor", "Enviada", ""]}
        rows={props.map((l) => [
          l.name,
          l.company,
          <StageTag key={l.id} stage={l.stage} />,
          formatBRL(l.value),
          formatDate(l.createdAt),
          <RowActions key={`a-${l.id}`} onEdit={() => onEdit(l)} onDelete={() => onDelete(l.id)} />,
        ])}
        empty="Nenhuma proposta em aberto."
      />
    </>
  );
}

// ===================== Formulários =====================

function FormulariosView({
  forms,
  onView,
  onArchive,
  onDelete,
}: {
  forms: FormEntry[];
  onView: (f: FormEntry) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <PageHead
        title="Central de formulários"
        subtitle="Todos os briefings enviados pelo site da ProductLab."
        count={forms.length}
      />
      {forms.length === 0 ? (
        <p className="crm-empty">Nenhum formulário recebido.</p>
      ) : (
        <div className="crm-panel crm-panel-flush">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Empresa</th>
                <th>E-mail</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>{formatDate(f.createdAt)}</td>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td>{f.company || "—"}</td>
                  <td>{f.email}</td>
                  <td>
                    <FormStatusTag status={f.status} />
                  </td>
                  <td>
                    <div className="crm-row-actions">
                      <button className="crm-link" onClick={() => onView(f)}>
                        Ver
                      </button>
                      {f.status !== "arquivado" && (
                        <button className="crm-link" onClick={() => onArchive(f.id)}>
                          Arquivar
                        </button>
                      )}
                      <button className="crm-link crm-link-danger" onClick={() => onDelete(f.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ===================== Modais =====================

function LeadModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSave: (input: LeadInput) => Promise<void>;
}) {
  const [form, setForm] = useState<LeadInput>(
    lead
      ? { name: lead.name, company: lead.company, email: lead.email, stage: lead.stage, value: lead.value }
      : { name: "", company: "", email: "", stage: "Novo", value: 0 },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Informe o nome.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <form className="crm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="crm-modal-title">{lead ? "Editar lead" : "Novo lead"}</h3>

        <label className="crm-field">
          <span className="crm-field-label">Nome</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome do contato"
            autoFocus
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Empresa</span>
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="Empresa"
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@empresa.com"
          />
        </label>
        <div className="crm-field-row">
          <label className="crm-field">
            <span className="crm-field-label">Etapa</span>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-field-label">Valor (R$)</span>
            <input
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })}
            />
          </label>
        </div>

        {err && <div className="crm-login-error">{err}</div>}

        <div className="crm-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormView({
  form,
  onClose,
  onConvert,
}: {
  form: FormEntry;
  onClose: () => void;
  onConvert: (f: FormEntry) => void;
}) {
  // Campos do briefing (payload) com rótulos amigáveis; cai pros básicos se vazio.
  const payload = form.payload ?? {};
  const entries = Object.keys(BRIEFING_LABELS)
    .map((k) => [k, (payload as Record<string, unknown>)[k]] as const)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal crm-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-head">
          <h3 className="crm-modal-title">{form.name}</h3>
          <FormStatusTag status={form.status} />
        </div>
        <p className="crm-modal-sub">
          {form.email}
          {form.company ? ` · ${form.company}` : ""} · {formatDate(form.createdAt)}
        </p>

        <div className="crm-detail">
          {entries.length > 0 ? (
            entries.map(([k, v]) => (
              <div className="crm-detail-row" key={k}>
                <span className="crm-detail-label">{BRIEFING_LABELS[k]}</span>
                <span className="crm-detail-value">{String(v)}</span>
              </div>
            ))
          ) : (
            <div className="crm-detail-row">
              <span className="crm-detail-label">Mensagem</span>
              <span className="crm-detail-value">{form.message || "—"}</span>
            </div>
          )}
        </div>

        <div className="crm-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          {form.status !== "convertido" && (
            <button type="button" className="btn btn-primary" onClick={() => onConvert(form)}>
              Converter em lead →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== Reutilizáveis =====================

function PageHead({
  title,
  subtitle,
  action,
  count,
}: {
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
  count?: number;
}) {
  return (
    <div className="crm-pagehead crm-pagehead-row">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {typeof count === "number" && <span className="crm-count-badge">{count}</span>}
      {action && (
        <button className="btn btn-primary crm-head-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
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

function FormStatusTag({ status }: { status: FormStatus }) {
  const label = status === "novo" ? "Novo" : status === "convertido" ? "Convertido" : "Arquivado";
  return <span className={`crm-status crm-status-${status}`}>{label}</span>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="crm-row-actions">
      <button className="crm-link" onClick={onEdit}>
        Editar
      </button>
      <button className="crm-link crm-link-danger" onClick={onDelete}>
        Excluir
      </button>
    </div>
  );
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
            {head.map((h, i) => (
              <th key={i}>{h}</th>
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

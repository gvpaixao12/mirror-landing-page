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
  type Cliente,
  type ClienteInput,
  fetchLeads,
  fetchForms,
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
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
  type Proposta,
  type PropostaInput,
  type PropostaStatus,
  PROPOSTA_STATUSES,
  fetchPropostas,
  createProposta,
  updateProposta,
  deleteProposta,
  nextPropostaNumber,
} from "../lib/crm-data";
import { buildProposal, type PricingSelection } from "../lib/proposal-data";
import { PRICING_CATALOG, PRICING_CATEGORIES } from "../lib/pricing-config";

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
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState("");

  // Modais
  const [leadModal, setLeadModal] = useState<{ open: boolean; lead: Lead | null }>({
    open: false,
    lead: null,
  });
  const [clienteModal, setClienteModal] = useState<{ open: boolean; cliente: Cliente | null }>({
    open: false,
    cliente: null,
  });
  const [viewingForm, setViewingForm] = useState<FormEntry | null>(null);
  const [propostaModal, setPropostaModal] = useState<{ open: boolean; proposta: Proposta | null }>({
    open: false,
    proposta: null,
  });

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
      // Propostas em try separado: se a tabela ainda não existir (rodar
      // supabase-setup.sql), o resto do painel continua funcionando.
      try {
        const ps = await fetchPropostas();
        if (active) setPropostas(ps);
      } catch {
        /* tabela propostas ausente — ignora */
      }
      // Clientes em try separado: idem propostas (rodar supabase-setup.sql).
      try {
        const cs = await fetchClientes();
        if (active) setClientes(cs);
      } catch {
        /* tabela clientes ausente — ignora */
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

  // ---- Clientes ----
  const saveCliente = async (input: ClienteInput) => {
    if (clienteModal.cliente) {
      await updateCliente(clienteModal.cliente.id, input);
      setClientes((cur) =>
        cur.map((c) => (c.id === clienteModal.cliente!.id ? { ...c, ...input } : c)),
      );
    } else {
      const created = await createCliente(input);
      setClientes((cur) => [created, ...cur]);
    }
    setClienteModal({ open: false, cliente: null });
  };

  const removeCliente = async (id: string) => {
    if (!confirm("Excluir este cliente? Esta ação não pode ser desfeita.")) return;
    const prev = clientes;
    setClientes((cur) => cur.filter((c) => c.id !== id));
    try {
      await deleteCliente(id);
    } catch {
      setClientes(prev);
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

  // ---- Propostas ----
  const saveProposta = async (input: PropostaInput) => {
    if (propostaModal.proposta) {
      await updateProposta(propostaModal.proposta.id, input);
      setPropostas((cur) =>
        cur.map((p) => (p.id === propostaModal.proposta!.id ? { ...p, ...input } : p)),
      );
    } else {
      const created = await createProposta(input);
      setPropostas((cur) => [created, ...cur]);
    }
    setPropostaModal({ open: false, proposta: null });
  };

  const removeProposta = async (id: string) => {
    if (!confirm("Excluir esta proposta? Esta ação não pode ser desfeita.")) return;
    const prev = propostas;
    setPropostas((cur) => cur.filter((p) => p.id !== id));
    try {
      await deleteProposta(id);
    } catch {
      setPropostas(prev);
    }
  };

  const openPdf = (id: string) => window.open(`/proposta?id=${id}`, "_blank");

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
          <ClientesView
            clientes={clientes}
            onNew={() => setClienteModal({ open: true, cliente: null })}
            onEdit={(c) => setClienteModal({ open: true, cliente: c })}
            onDelete={removeCliente}
          />
        )}
        {view === "propostas" && (
          <PropostasView
            propostas={propostas}
            onNew={() => setPropostaModal({ open: true, proposta: null })}
            onEdit={(p) => setPropostaModal({ open: true, proposta: p })}
            onDelete={removeProposta}
            onPdf={openPdf}
          />
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
      {clienteModal.open && (
        <ClienteModal
          cliente={clienteModal.cliente}
          onClose={() => setClienteModal({ open: false, cliente: null })}
          onSave={saveCliente}
        />
      )}
      {viewingForm && (
        <FormView form={viewingForm} onClose={() => setViewingForm(null)} onConvert={convertForm} />
      )}
      {propostaModal.open && (
        <PropostaModal
          proposta={propostaModal.proposta}
          existing={propostas}
          onClose={() => setPropostaModal({ open: false, proposta: null })}
          onSave={saveProposta}
        />
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
  clientes,
  onNew,
  onEdit,
  onDelete,
}: {
  clientes: Cliente[];
  onNew: () => void;
  onEdit: (c: Cliente) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clientes.filter((c) =>
        [c.name, c.company, c.email, c.phone, c.city, c.uf].join(" ").toLowerCase().includes(q),
      )
    : clientes;

  return (
    <>
      <PageHead
        title="Clientes"
        subtitle="Base de clientes ativos e contatos comerciais."
        action={{ label: "+ Novo cliente", onClick: onNew }}
        extra={
          <input
            className="crm-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
          />
        }
      />
      <Table
        head={["Nome", "Empresa", "E-mail", "Telefone", "Cidade/UF", "Criado em", ""]}
        rows={filtered.map((c) => [
          c.name,
          c.company || "—",
          c.email || "—",
          c.phone || "—",
          [c.city, c.uf].filter(Boolean).join("/") || "—",
          formatDate(c.createdAt),
          <RowActions key={`a-${c.id}`} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />,
        ])}
        empty="Nenhum cliente cadastrado."
      />
    </>
  );
}

// ===================== Propostas =====================

function PropostasView({
  propostas,
  onNew,
  onEdit,
  onDelete,
  onPdf,
}: {
  propostas: Proposta[];
  onNew: () => void;
  onEdit: (p: Proposta) => void;
  onDelete: (id: string) => void;
  onPdf: (id: string) => void;
}) {
  return (
    <>
      <PageHead
        title="Propostas"
        subtitle="Crie, edite e exporte propostas comerciais em PDF."
        action={{ label: "+ Nova proposta", onClick: onNew }}
      />
      <Table
        head={["Número", "Cliente", "Empresa", "Data", "Valor", "Status", ""]}
        rows={propostas.map((p) => [
          <strong key={`n-${p.id}`}>{p.number}</strong>,
          p.clientName,
          p.company || "—",
          formatDate(p.createdAt),
          formatBRL(p.value),
          <PropostaStatusTag key={`s-${p.id}`} status={p.status} />,
          <div className="crm-row-actions" key={`a-${p.id}`}>
            <button className="crm-link" onClick={() => onPdf(p.id)}>
              PDF
            </button>
            <button className="crm-link" onClick={() => onEdit(p)}>
              Editar
            </button>
            <button className="crm-link crm-link-danger" onClick={() => onDelete(p.id)}>
              Excluir
            </button>
          </div>,
        ])}
        empty="Nenhuma proposta ainda. Clique em “+ Nova proposta”."
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

function ClienteModal({
  cliente,
  onClose,
  onSave,
}: {
  cliente: Cliente | null;
  onClose: () => void;
  onSave: (input: ClienteInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ClienteInput>(
    cliente
      ? {
          name: cliente.name,
          company: cliente.company,
          email: cliente.email,
          phone: cliente.phone,
          city: cliente.city,
          uf: cliente.uf,
        }
      : { name: "", company: "", email: "", phone: "", city: "", uf: "" },
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
      await onSave({ ...form, uf: form.uf.toUpperCase() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <form className="crm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="crm-modal-title">{cliente ? "Editar cliente" : "Novo cliente"}</h3>

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
          <span className="crm-field-label">E-mail</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@empresa.com"
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </label>
        <div className="crm-field-row">
          <label className="crm-field">
            <span className="crm-field-label">Cidade</span>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Cidade"
            />
          </label>
          <label className="crm-field">
            <span className="crm-field-label">UF</span>
            <input
              value={form.uf}
              maxLength={2}
              onChange={(e) => setForm({ ...form, uf: e.target.value })}
              placeholder="UF"
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

// Estado local dos itens adicionais (addons) marcáveis no formulário de proposta.
type AddonState = Record<string, { checked: boolean; price: number; observation: string }>;

function initialAddonState(content: Proposta["content"] | undefined): AddonState {
  const existingItems = content?.investment.options[0]?.items?.filter((it) => it.id) ?? [];
  const byId = new Map(existingItems.map((it) => [it.id as string, it]));
  const state: AddonState = {};
  for (const item of PRICING_CATALOG) {
    const existing = byId.get(item.id);
    state[item.id] = {
      checked: !!existing,
      price: existing?.price ?? item.defaultPrice,
      observation: existing?.observation ?? "",
    };
  }
  return state;
}

function PropostaModal({
  proposta,
  existing,
  onClose,
  onSave,
}: {
  proposta: Proposta | null;
  existing: Proposta[];
  onClose: () => void;
  onSave: (input: PropostaInput) => Promise<void>;
}) {
  const c = proposta?.content;
  const [clientName, setClientName] = useState(proposta?.clientName ?? "");
  const [company, setCompany] = useState(proposta?.company ?? "");
  const [title, setTitle] = useState(c?.title ?? "");
  // Valor base (plataforma/escopo principal) — itens adicionais somam em cima dele.
  const [baseValue, setBaseValue] = useState(
    c?.investment.options[0]?.items?.[0]?.price ?? proposta?.value ?? 0,
  );
  const [status, setStatus] = useState<PropostaStatus>(proposta?.status ?? "Rascunho");
  const [understanding, setUnderstanding] = useState(c?.understanding.intro ?? "");
  const [solution, setSolution] = useState(c?.solution.intro ?? "");
  const [scopeText, setScopeText] = useState((c?.scope.included ?? []).join("\n"));
  const [nextStep, setNextStep] = useState(c?.nextStep ?? "");
  const [addonState, setAddonState] = useState<AddonState>(() => initialAddonState(c));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const addonsTotal = Object.values(addonState).reduce((s, a) => s + (a.checked ? a.price : 0), 0);
  const total = baseValue + addonsTotal;

  const toggleAddon = (id: string) =>
    setAddonState((s) => ({ ...s, [id]: { ...s[id], checked: !s[id].checked } }));
  const setAddonPrice = (id: string, price: number) =>
    setAddonState((s) => ({ ...s, [id]: { ...s[id], price } }));
  const setAddonObservation = (id: string, observation: string) =>
    setAddonState((s) => ({ ...s, [id]: { ...s[id], observation } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErr("Informe o cliente.");
      return;
    }
    if (!title.trim()) {
      setErr("Informe o título do projeto.");
      return;
    }
    setSaving(true);
    setErr("");
    const number = proposta ? proposta.number : nextPropostaNumber(existing);
    const addons: PricingSelection[] = PRICING_CATALOG.filter(
      (item) => addonState[item.id].checked,
    ).map((item) => ({
      id: item.id,
      label: item.label,
      price: addonState[item.id].price,
      observation: addonState[item.id].observation.trim() || undefined,
    }));
    const content = buildProposal({
      number,
      clientName: clientName.trim(),
      company: company.trim(),
      title: title.trim(),
      baseValue,
      addons,
      understanding,
      solution,
      scope: scopeText.split("\n"),
      nextStep,
      date: proposta?.content.date,
      validUntil: proposta?.content.validUntil,
    });
    try {
      await onSave({
        number,
        clientName: clientName.trim(),
        company: company.trim(),
        value: total,
        status,
        content,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <form
        className="crm-modal crm-modal-wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="crm-modal-title">
          {proposta ? `Editar ${proposta.number}` : "Nova proposta"}
        </h3>

        <div className="crm-field-row">
          <label className="crm-field">
            <span className="crm-field-label">Cliente</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do contato"
              autoFocus
            />
          </label>
          <label className="crm-field">
            <span className="crm-field-label">Empresa</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Empresa"
            />
          </label>
        </div>

        <label className="crm-field">
          <span className="crm-field-label">Título do projeto</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Portal de Representantes"
          />
        </label>

        <div className="crm-field-row">
          <label className="crm-field">
            <span className="crm-field-label">Valor base (R$)</span>
            <input
              type="number"
              min={0}
              value={baseValue}
              onChange={(e) => setBaseValue(Number(e.target.value) || 0)}
            />
          </label>
          <label className="crm-field">
            <span className="crm-field-label">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as PropostaStatus)}>
              {PROPOSTA_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="crm-field">
          <span className="crm-field-label">Itens adicionais (precificação dinâmica)</span>
          <div className="crm-addons">
            {PRICING_CATEGORIES.map((cat) => (
              <div className="crm-addon-cat" key={cat}>
                <div className="crm-addon-cat-title">{cat}</div>
                {PRICING_CATALOG.filter((item) => item.category === cat).map((item) => {
                  const st = addonState[item.id];
                  return (
                    <div className="crm-addon-row" key={item.id}>
                      <label className="crm-addon-check">
                        <input
                          type="checkbox"
                          checked={st.checked}
                          onChange={() => toggleAddon(item.id)}
                        />
                        <span>{item.label}</span>
                      </label>
                      {st.checked && (
                        <div className="crm-addon-fields">
                          <input
                            type="number"
                            min={0}
                            value={st.price}
                            onChange={(e) => setAddonPrice(item.id, Number(e.target.value) || 0)}
                            aria-label={`Preço — ${item.label}`}
                          />
                          <input
                            type="text"
                            value={st.observation}
                            onChange={(e) => setAddonObservation(item.id, e.target.value)}
                            placeholder="Observação (opcional)"
                            aria-label={`Observação — ${item.label}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="crm-total-bar">
            <span>Valor total estimado</span>
            <strong>{formatBRL(total)}</strong>
          </div>
        </div>

        <label className="crm-field">
          <span className="crm-field-label">O que entendemos (problema do cliente)</span>
          <textarea
            rows={3}
            value={understanding}
            onChange={(e) => setUnderstanding(e.target.value)}
            placeholder="Resuma a dor do cliente nas palavras dele."
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Nossa solução</span>
          <textarea
            rows={3}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="O que será entregue, focado no resultado."
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Escopo (um item por linha)</span>
          <textarea
            rows={4}
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            placeholder={"Login individual\nDashboard de comissão\nIntegração com o Bling"}
          />
        </label>
        <label className="crm-field">
          <span className="crm-field-label">Próximo passo (opcional)</span>
          <textarea
            rows={2}
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="Deixe em branco pra usar o texto padrão."
          />
        </label>

        {err && <div className="crm-login-error">{err}</div>}

        <div className="crm-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar proposta"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ===================== Reutilizáveis =====================

function PageHead({
  title,
  subtitle,
  action,
  count,
  extra,
}: {
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
  count?: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="crm-pagehead crm-pagehead-row">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {typeof count === "number" && <span className="crm-count-badge">{count}</span>}
      {extra}
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

// Reaproveita as cores dos status de formulário pros status de proposta.
const PSTATUS_CLASS: Record<PropostaStatus, string> = {
  Rascunho: "crm-status-arquivado",
  Enviada: "crm-status-novo",
  Aceita: "crm-status-convertido",
  Recusada: "crm-status-arquivado",
};

function PropostaStatusTag({ status }: { status: PropostaStatus }) {
  return <span className={`crm-status ${PSTATUS_CLASS[status]}`}>{status}</span>;
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

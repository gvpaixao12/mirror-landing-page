import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentName, isAuthed, isCurrentUserAdmin, logout, signUp } from "../lib/admin-auth";
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
  setPropostaLead,
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
  const [userName, setUserName] = useState("");

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
  const [accountModal, setAccountModal] = useState(false);

  // Proteção de rota + carga inicial dos dados.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!(await isAuthed())) {
        navigate({ to: "/login" });
        return;
      }
      if (!(await isCurrentUserAdmin())) {
        // Autenticado, mas sem permissão de admin: encerra a sessão e volta.
        await logout();
        if (active) navigate({ to: "/login" });
        return;
      }
      if (!active) return;
      setUserName((await getCurrentName()) ?? "");
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

  // (Des)vincula uma proposta a um lead (usado no painel de detalhe do Kanban).
  const linkProposta = async (propostaId: string, leadId: string | null) => {
    const prev = propostas;
    setPropostas((cur) => cur.map((p) => (p.id === propostaId ? { ...p, leadId } : p)));
    try {
      await setPropostaLead(propostaId, leadId);
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
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="plOrbitGradCrm"
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
              stroke="url(#plOrbitGradCrm)"
              strokeWidth="4.5"
              opacity="0.45"
            />
            <circle cx="32" cy="32" r="6.5" fill="url(#plOrbitGradCrm)" />
            <circle cx="32" cy="13" r="5.5" fill="url(#plOrbitGradCrm)" />
          </svg>
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
          <button
            type="button"
            className="crm-user-row crm-user-row-btn"
            onClick={() => setAccountModal(true)}
            title="Criar nova conta"
          >
            <span className="crm-avatar">{(userName[0] || "A").toUpperCase()}</span>
            <div className="crm-user-info">
              <strong>{userName || "Administrador"}</strong>
              <span>Criar conta +</span>
            </div>
          </button>
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
            propostas={propostas}
            moveLead={moveLead}
            onEdit={(l) => setLeadModal({ open: true, lead: l })}
            onDelete={removeLead}
            onNew={() => setLeadModal({ open: true, lead: null })}
            onPdf={openPdf}
            onLink={linkProposta}
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
          <>
            <PropostasView
              propostas={propostas}
              onNew={() => setPropostaModal({ open: true, proposta: null })}
              onEdit={(p) => setPropostaModal({ open: true, proposta: p })}
              onDelete={removeProposta}
              onPdf={openPdf}
            />
            <ProposalChatWidget />
          </>
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
          leads={leads}
          onClose={() => setPropostaModal({ open: false, proposta: null })}
          onSave={saveProposta}
        />
      )}
      {accountModal && <AccountModal onClose={() => setAccountModal(false)} />}
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

// Slug por etapa pra colorir o cabeçalho de cada coluna do Kanban.
const STAGE_SLUG: Record<Stage, string> = {
  Novo: "novo",
  Qualificação: "qualificacao",
  Reunião: "reuniao",
  Proposta: "proposta",
  Negociação: "negociacao",
  Ganho: "ganho",
  Perdido: "perdido",
};

// ===================== Kanban (drag & drop) =====================

function KanbanView({
  leads,
  propostas,
  moveLead,
  onEdit,
  onDelete,
  onNew,
  onPdf,
  onLink,
}: {
  leads: Lead[];
  propostas: Proposta[];
  moveLead: (id: string, stage: Stage) => void;
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onPdf: (id: string) => void;
  onLink: (propostaId: string, leadId: string | null) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  // Lead aberto no painel de detalhe (mostra as propostas vinculadas).
  const [detail, setDetail] = useState<Lead | null>(null);

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
              <div className={`crm-kanban-head crm-kanban-head--${STAGE_SLUG[stage]}`}>
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
                      onClick={() => setDetail(l)}
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                    >
                      <div className="crm-card-top">
                        <strong>{l.name}</strong>
                        <div className="crm-card-actions">
                          <button
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(l);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            title="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(l.id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <span>{l.company}</span>
                      <span className="crm-card-value">{formatBRL(l.value)}</span>
                      {propostasForLead(l, propostas).length > 0 && (
                        <span className="crm-card-tag">
                          ≡ {propostasForLead(l, propostas).length} proposta
                          {propostasForLead(l, propostas).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <LeadDetailModal
          lead={detail}
          propostas={propostas}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const l = detail;
            setDetail(null);
            onEdit(l);
          }}
          onPdf={onPdf}
          onLink={onLink}
        />
      )}
    </>
  );
}

// Propostas vinculadas a um lead — só pelo vínculo explícito (lead_id).
// Como cada proposta tem um único lead_id, ela aparece em no máximo um lead.
function propostasForLead(lead: Lead, propostas: Proposta[]): Proposta[] {
  return propostas.filter((p) => p.leadId === lead.id);
}

// Painel de detalhe do card: dados do lead + propostas vinculadas.
function LeadDetailModal({
  lead,
  propostas,
  onClose,
  onEdit,
  onPdf,
  onLink,
}: {
  lead: Lead;
  propostas: Proposta[]; // todas as propostas (pra montar a lista de disponíveis)
  onClose: () => void;
  onEdit: () => void;
  onPdf: (id: string) => void;
  onLink: (propostaId: string, leadId: string | null) => void;
}) {
  const linked = propostasForLead(lead, propostas);
  // Só dá pra vincular propostas que ainda não pertencem a ninguém — assim
  // uma proposta nunca fica em dois leads.
  const available = propostas.filter((p) => !p.leadId);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const confirmLink = () => {
    if (!pick) return;
    onLink(pick, lead.id);
    setPick("");
    setPicking(false);
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-head">
          <h3 className="crm-modal-title">{lead.name}</h3>
          <span className="crm-status">{lead.stage}</span>
        </div>
        <p className="crm-modal-sub">
          {lead.company || "—"}
          {lead.email ? ` · ${lead.email}` : ""} · {formatBRL(lead.value)}
        </p>

        <div className="crm-modal-section-row">
          <h4 className="crm-modal-section">
            Propostas vinculadas {linked.length > 0 && `(${linked.length})`}
          </h4>
          {!picking && (
            <button
              type="button"
              className="crm-link"
              onClick={() => setPicking(true)}
              disabled={available.length === 0}
              title={available.length === 0 ? "Nenhuma proposta avulsa disponível" : undefined}
            >
              + Vincular proposta
            </button>
          )}
        </div>

        {picking && (
          <div className="crm-link-row">
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Selecione uma proposta…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} — {p.clientName}
                  {p.company ? ` · ${p.company}` : ""} ({formatBRL(p.value)})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={confirmLink}>
              Vincular
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPicking(false);
                setPick("");
              }}
            >
              Cancelar
            </button>
          </div>
        )}

        {linked.length === 0 ? (
          <p className="crm-empty-sm">Nenhuma proposta vinculada a este lead.</p>
        ) : (
          <ul className="crm-detail-list">
            {linked.map((p) => (
              <li key={p.id} className="crm-detail-item">
                <div>
                  <strong>{p.number}</strong>
                  <span className="crm-detail-meta">
                    {formatDate(p.createdAt)} · {formatBRL(p.value)}
                  </span>
                </div>
                <div className="crm-detail-item-right">
                  <PropostaStatusTag status={p.status} />
                  <button className="crm-link" onClick={() => onPdf(p.id)}>
                    PDF
                  </button>
                  <button
                    className="crm-link crm-link-danger"
                    onClick={() => onLink(p.id, null)}
                    title="Desvincular proposta deste lead"
                  >
                    Desvincular
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="crm-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            Editar lead
          </button>
        </div>
      </div>
    </div>
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

// ===================== Widget de chat (gerar proposta) =====================

type ChatMsg = { role: "user" | "bot"; text: string };
type ChatLead = { name: string; company: string; phone: string };

// Máscara de telefone BR: até 11 dígitos → (99) 99999-9999 (celular) ou (99) 9999-9999 (fixo).
function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function ProposalChatWidget() {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<ChatLead | null>(null);
  // Dados de contato exigidos antes de liberar o chat.
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");

  const intakeValid = name.trim() && company.trim() && phone.trim();

  const startChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeValid) return;
    const firstName = name.trim().split(" ")[0];
    setLead({ name: name.trim(), company: company.trim(), phone: phone.trim() });
    setMessages([
      {
        role: "bot",
        text: `Oi, ${firstName}! Me conta o que você precisa: qual problema quer resolver, pra quem é e o que espera do projeto. Vou usar isso pra montar a proposta.`,
      },
    ]);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    // TODO (fase 2 — IA): chamar a server function de geração com { lead, contexto: text }
    // e devolver um Proposal preenchido pra abrir no PropostaModal/PDF.
    setMessages((m) => [
      ...m,
      {
        role: "bot",
        text: "Anotado! A geração automática da proposta com IA entra na próxima etapa.",
      },
    ]);
  };

  const reset = () => {
    setLead(null);
    setName("");
    setCompany("");
    setPhone("");
    setMessages([]);
    setInput("");
  };

  if (!open) {
    return (
      <button
        className="crm-chat-fab"
        onClick={() => setOpen(true)}
        title="Gerar proposta com IA"
        aria-label="Abrir assistente de propostas"
      >
        💬
      </button>
    );
  }

  return (
    <div className="crm-chat-panel">
      <div className="crm-chat-head">
        <div>
          <strong>Product.Inho</strong>
          <span className="crm-chat-sub">{lead ? lead.company : "Assistente de propostas"}</span>
        </div>
        <div className="crm-chat-head-actions">
          {lead && (
            <button className="crm-chat-icon" onClick={reset} title="Recomeçar">
              ↺
            </button>
          )}
          <button className="crm-chat-icon" onClick={() => setOpen(false)} title="Fechar">
            ✕
          </button>
        </div>
      </div>

      {!lead ? (
        <form className="crm-chat-intake" onSubmit={startChat}>
          <p className="crm-chat-hint">Pra começar, preencha seus dados de contato.</p>
          <label className="crm-field">
            <span className="crm-field-label">Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoFocus />
          </label>
          <label className="crm-field">
            <span className="crm-field-label">Empresa</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome da empresa"
            />
          </label>
          <label className="crm-field">
            <span className="crm-field-label">Telefone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
              type="tel"
              inputMode="tel"
              maxLength={15}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={!intakeValid}>
            Começar
          </button>
        </form>
      ) : (
        <>
          <div className="crm-chat-body">
            {messages.map((m, i) => (
              <div key={i} className={"crm-chat-msg crm-chat-msg-" + m.role}>
                {m.text}
              </div>
            ))}
          </div>
          <form className="crm-chat-input" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva o que você precisa..."
            />
            <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
              ↑
            </button>
          </form>
        </>
      )}
    </div>
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

function AccountModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Informe o nome.");
    if (!email.trim()) return setErr("Informe o email.");
    if (password.length < 6) return setErr("A senha precisa ter pelo menos 6 caracteres.");
    setSaving(true);
    setErr("");
    const res = await signUp(name, email, password, isAdmin);
    setSaving(false);
    if (!res.ok) return setErr(res.error || "Falha ao criar conta.");
    setDone(true);
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <form className="crm-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="crm-modal-title">Criar conta</h3>

        {done ? (
          <>
            <p className="crm-modal-sub">
              Conta de <strong>{email}</strong> criada
              {isAdmin ? " como administrador" : ""}. Enviamos um email de confirmação — o acesso é
              liberado após o usuário validar o endereço.
            </p>
            <div className="crm-modal-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="crm-field">
              <span className="crm-field-label">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da pessoa"
                autoFocus
              />
            </label>
            <label className="crm-field">
              <span className="crm-field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
            </label>
            <label className="crm-field">
              <span className="crm-field-label">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </label>
            <label className="crm-check">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              <span>Administrador</span>
            </label>

            {err && <div className="crm-login-error">{err}</div>}

            <div className="crm-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Criando..." : "Criar conta"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

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
  leads,
  onClose,
  onSave,
}: {
  proposta: Proposta | null;
  existing: Proposta[];
  leads: Lead[];
  onClose: () => void;
  onSave: (input: PropostaInput) => Promise<void>;
}) {
  const c = proposta?.content;
  const [leadId, setLeadId] = useState<string | null>(proposta?.leadId ?? null);
  const [clientName, setClientName] = useState(proposta?.clientName ?? "");
  const [company, setCompany] = useState(proposta?.company ?? "");
  const [title, setTitle] = useState(c?.title ?? "");
  // Valor base (plataforma/escopo principal) — itens adicionais somam em cima dele.
  const [baseValue, setBaseValue] = useState(
    c?.investment.options[0]?.items?.[0]?.price ?? proposta?.value ?? 0,
  );
  const [status, setStatus] = useState<PropostaStatus>(proposta?.status ?? "Rascunho");

  // Ao escolher um lead, vincula e preenche cliente/empresa a partir dele.
  const onPickLead = (id: string) => {
    if (!id) {
      setLeadId(null);
      return;
    }
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      setClientName(lead.name);
      setCompany(lead.company);
    }
  };
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
        leadId,
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

        <label className="crm-field">
          <span className="crm-field-label">Lead vinculado (funil)</span>
          <select value={leadId ?? ""} onChange={(e) => onPickLead(e.target.value)}>
            <option value="">— Nenhum (proposta avulsa) —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.company ? ` · ${l.company}` : ""}
              </option>
            ))}
          </select>
        </label>

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

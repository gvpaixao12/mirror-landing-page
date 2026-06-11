// =====================================================
// Dados do CRM (mock / em memória)
// -----------------------------------------------------
// Como o projeto ainda não tem backend/banco, os dados abaixo são
// fixos só pra o painel renderizar com números reais. Quando houver
// API, troque estes arrays por dados vindos do servidor.
// =====================================================

export const STAGES = [
  "Novo",
  "Qualificação",
  "Reunião",
  "Proposta",
  "Negociação",
  "Ganho",
  "Perdido",
] as const;

export type Stage = (typeof STAGES)[number];

// Etapas que contam como "em negociação" no resumo
export const NEGOTIATION_STAGES: Stage[] = ["Proposta", "Negociação"];

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  stage: Stage;
  value: number; // R$
  createdAt: string; // ISO
}

export interface FormEntry {
  id: string;
  name: string;
  email: string;
  message: string;
  isNew: boolean;
  createdAt: string; // ISO
}

// --- Leads (espelha o print: 1 lead, em "Qualificação") ---
export const leads: Lead[] = [
  {
    id: "l1",
    name: "Marina Tavares",
    company: "Distribuidora XYZ",
    email: "marina@xyz.com.br",
    stage: "Qualificação",
    value: 0,
    createdAt: "2026-06-09T14:20:00Z",
  },
];

// --- Formulários recebidos (espelha o print: 2 no total, 1 novo) ---
export const forms: FormEntry[] = [
  {
    id: "f1",
    name: "João Pereira",
    email: "joao@empresa.com",
    message: "Quero um portal pros representantes verem comissão em tempo real.",
    isNew: true,
    createdAt: "2026-06-10T09:05:00Z",
  },
  {
    id: "f2",
    name: "Carla Souza",
    email: "carla@loja.com.br",
    message: "Preciso integrar Bling + planilhas num painel só.",
    isNew: false,
    createdAt: "2026-06-08T16:40:00Z",
  },
];

// ===================== Derivados =====================

export interface CrmSummary {
  totalLeads: number;
  newLeads: number;
  inNegotiation: number;
  forms: number;
  newForms: number;
  closedDeals: number;
  estimatedValue: number;
  closedValue: number;
  conversion: number; // %
}

export function getSummary(): CrmSummary {
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.stage === "Novo").length;
  const inNegotiation = leads.filter((l) =>
    NEGOTIATION_STAGES.includes(l.stage),
  ).length;
  const won = leads.filter((l) => l.stage === "Ganho");
  const estimatedValue = leads
    .filter((l) => l.stage !== "Perdido")
    .reduce((sum, l) => sum + l.value, 0);
  const closedValue = won.reduce((sum, l) => sum + l.value, 0);
  const conversion = totalLeads > 0 ? Math.round((won.length / totalLeads) * 100) : 0;

  return {
    totalLeads,
    newLeads,
    inNegotiation,
    forms: forms.length,
    newForms: forms.filter((f) => f.isNew).length,
    closedDeals: won.length,
    estimatedValue,
    closedValue,
    conversion,
  };
}

export function getFunnel(): { stage: Stage; count: number }[] {
  return STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

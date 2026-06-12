// =====================================================
// Dados do CRM — vindos do Supabase (tabelas leads e forms).
// =====================================================

import { supabase } from "./supabase";

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

export type FormStatus = "novo" | "convertido" | "arquivado";

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
  company: string;
  message: string;
  payload: Record<string, unknown>;
  status: FormStatus;
  createdAt: string; // ISO
}

// ===================== Mapeadores (linha do banco -> tipo) =====================

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  stage: Stage;
  value: number | string | null;
  created_at: string;
}

interface FormRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  status: FormStatus;
  created_at: string;
}

function rowToLead(r: LeadRow): Lead {
  return {
    id: r.id,
    name: r.name,
    company: r.company ?? "",
    email: r.email ?? "",
    stage: r.stage,
    value: Number(r.value ?? 0),
    createdAt: r.created_at,
  };
}

function rowToForm(r: FormRow): FormEntry {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    company: r.company ?? "",
    message: r.message ?? "",
    payload: r.payload ?? {},
    status: r.status,
    createdAt: r.created_at,
  };
}

// ===================== Leads (CRUD) =====================

export interface LeadInput {
  name: string;
  company: string;
  email: string;
  stage: Stage;
  value: number;
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as LeadRow[]).map(rowToLead);
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert(input).select().single();
  if (error) throw error;
  return rowToLead(data as LeadRow);
}

export async function updateLead(id: string, input: LeadInput): Promise<void> {
  const { error } = await supabase.from("leads").update(input).eq("id", id);
  if (error) throw error;
}

export async function updateLeadStage(id: string, stage: Stage): Promise<void> {
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

// ===================== Forms (briefing) =====================

export async function fetchForms(): Promise<FormEntry[]> {
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as FormRow[]).map(rowToForm);
}

export interface BriefingInput {
  name: string;
  email: string;
  company?: string;
  message?: string;
  payload?: Record<string, unknown>;
}

// Insert público (usado pelo /briefing no site)
export async function createForm(input: BriefingInput): Promise<void> {
  const { error } = await supabase.from("forms").insert({
    name: input.name,
    email: input.email,
    company: input.company ?? "",
    message: input.message ?? "",
    payload: input.payload ?? {},
  });
  if (error) throw error;
}

export async function setFormStatus(id: string, status: FormStatus): Promise<void> {
  const { error } = await supabase.from("forms").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteForm(id: string): Promise<void> {
  const { error } = await supabase.from("forms").delete().eq("id", id);
  if (error) throw error;
}

// Converte um formulário em lead (cria no funil e marca como convertido)
export async function convertFormToLead(form: FormEntry): Promise<Lead> {
  const lead = await createLead({
    name: form.name,
    company: form.company,
    email: form.email,
    stage: "Novo",
    value: 0,
  });
  await setFormStatus(form.id, "convertido");
  return lead;
}

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

export function getSummary(leads: Lead[], forms: FormEntry[]): CrmSummary {
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.stage === "Novo").length;
  const inNegotiation = leads.filter((l) => NEGOTIATION_STAGES.includes(l.stage)).length;
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
    newForms: forms.filter((f) => f.status === "novo").length,
    closedDeals: won.length,
    estimatedValue,
    closedValue,
    conversion,
  };
}

export function getFunnel(leads: Lead[]): { stage: Stage; count: number }[] {
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

// Rótulos amigáveis dos campos do briefing (pra tela "Ver detalhes")
export const BRIEFING_LABELS: Record<string, string> = {
  name: "Nome",
  email: "Email",
  company: "Empresa",
  location: "Cidade / Estado",
  role: "Atuação",
  industry: "Setor",
  teamSize: "Tamanho do time",
  goal: "Objetivo",
  problem: "Problema atual",
  tools: "Ferramentas",
  budget: "Investimento",
  timeline: "Prazo",
  notes: "Observações",
};

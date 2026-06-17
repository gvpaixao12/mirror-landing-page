// =====================================================
// Dados do CRM — vindos do Supabase (tabelas leads e forms).
// =====================================================

import { supabase } from "./supabase";
import type { Proposal } from "./proposal-data";

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

// ===================== Clientes (CRUD) =====================

export interface Cliente {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  uf: string;
  createdAt: string; // ISO
}

export interface ClienteInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  uf: string;
}

interface ClienteRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  created_at: string;
}

function rowToCliente(r: ClienteRow): Cliente {
  return {
    id: r.id,
    name: r.name,
    company: r.company ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    uf: r.uf ?? "",
    createdAt: r.created_at,
  };
}

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ClienteRow[]).map(rowToCliente);
}

export async function createCliente(input: ClienteInput): Promise<Cliente> {
  const { data, error } = await supabase.from("clientes").insert(input).select().single();
  if (error) throw error;
  return rowToCliente(data as ClienteRow);
}

export async function updateCliente(id: string, input: ClienteInput): Promise<void> {
  const { error } = await supabase.from("clientes").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
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

// ===================== Propostas (CRUD) =====================

export const PROPOSTA_STATUSES = ["Rascunho", "Enviada", "Aceita", "Recusada"] as const;
export type PropostaStatus = (typeof PROPOSTA_STATUSES)[number];

export interface Proposta {
  id: string;
  number: string; // PROP-2026-0001
  clientName: string;
  company: string;
  value: number; // R$ (valor de destaque que aparece na lista)
  status: PropostaStatus;
  content: Proposal; // conteúdo completo usado pra renderizar o PDF
  leadId: string | null; // vínculo com o lead do funil (null = avulsa)
  createdAt: string; // ISO
}

export interface PropostaInput {
  number: string;
  clientName: string;
  company: string;
  value: number;
  status: PropostaStatus;
  content: Proposal;
  leadId?: string | null;
}

interface PropostaRow {
  id: string;
  number: string;
  client_name: string;
  company: string | null;
  value: number | string | null;
  status: PropostaStatus;
  content: Proposal;
  lead_id: string | null;
  created_at: string;
}

function rowToProposta(r: PropostaRow): Proposta {
  return {
    id: r.id,
    number: r.number,
    clientName: r.client_name,
    company: r.company ?? "",
    value: Number(r.value ?? 0),
    status: r.status,
    content: r.content,
    leadId: r.lead_id ?? null,
    createdAt: r.created_at,
  };
}

export async function fetchPropostas(): Promise<Proposta[]> {
  const { data, error } = await supabase
    .from("propostas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PropostaRow[]).map(rowToProposta);
}

export async function fetchPropostaById(id: string): Promise<Proposta | null> {
  const { data, error } = await supabase.from("propostas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToProposta(data as PropostaRow) : null;
}

export async function createProposta(input: PropostaInput): Promise<Proposta> {
  const { data, error } = await supabase
    .from("propostas")
    .insert({
      number: input.number,
      client_name: input.clientName,
      company: input.company,
      value: input.value,
      status: input.status,
      content: input.content,
      lead_id: input.leadId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToProposta(data as PropostaRow);
}

export async function updateProposta(id: string, input: PropostaInput): Promise<void> {
  const { error } = await supabase
    .from("propostas")
    .update({
      client_name: input.clientName,
      company: input.company,
      value: input.value,
      status: input.status,
      content: input.content,
      lead_id: input.leadId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProposta(id: string): Promise<void> {
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw error;
}

// (Des)vincula uma proposta a um lead. leadId null = proposta avulsa.
// Como cada proposta guarda um único lead_id, ela nunca fica em dois leads.
export async function setPropostaLead(id: string, leadId: string | null): Promise<void> {
  const { error } = await supabase.from("propostas").update({ lead_id: leadId }).eq("id", id);
  if (error) throw error;
}

// Gera o próximo número (PROP-ANO-0001) a partir das propostas já existentes.
export function nextPropostaNumber(existing: Proposta[]): string {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const maxSeq = existing
    .map((p) => p.number)
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
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

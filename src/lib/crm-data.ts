// =====================================================
// Dados do CRM — agora vindos do Supabase (tabelas leads e forms).
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
  message: string | null;
  is_new: boolean;
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
    message: r.message ?? "",
    isNew: r.is_new,
    createdAt: r.created_at,
  };
}

// ===================== Leads =====================

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as LeadRow[]).map(rowToLead);
}

export async function updateLeadStage(id: string, stage: Stage): Promise<void> {
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
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
    newForms: forms.filter((f) => f.isNew).length,
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

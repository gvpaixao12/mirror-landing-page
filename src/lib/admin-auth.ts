// =====================================================
// Autenticação simples do painel admin (CRM)
// -----------------------------------------------------
// ATENÇÃO: isto é uma proteção BÁSICA, feita 100% no navegador.
// A senha abaixo fica visível no código do site, então NÃO é segura
// contra alguém determinado. Serve pra esconder o painel do público.
// Quando houver backend, troque por login de verdade no servidor.
//
// >>> Pra trocar email/senha de acesso, edite as duas constantes abaixo. <<<
// =====================================================

const ADMIN_EMAIL = "admin@productlab.local";
const ADMIN_PASSWORD = "PLab#Admin@2026!";

const SESSION_KEY = "pl_admin_session";

export interface AdminSession {
  email: string;
  at: number;
}

export function login(email: string, password: string): boolean {
  const ok =
    email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    password === ADMIN_PASSWORD;
  if (ok && typeof window !== "undefined") {
    const session: AdminSession = { email: ADMIN_EMAIL, at: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return ok;
}

export function logout(): void {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
}

export function getSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function isAuthed(): boolean {
  return getSession() !== null;
}

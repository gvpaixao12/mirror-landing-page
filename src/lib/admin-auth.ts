// =====================================================
// Autenticação do painel admin — agora via Supabase Auth.
// Login de verdade: e-mail/senha validados no servidor do Supabase,
// sessão segura gerenciada pelo supabase-js.
//
// >>> Pra criar/trocar usuários, use o painel do Supabase:
//     Authentication > Users. <<<
// =====================================================

import { supabase } from "./supabase";

export async function login(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function isAuthed(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

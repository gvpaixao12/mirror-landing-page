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

// Cria um novo usuário a partir do painel, SEM logar como ele.
// Requer "Confirm email" LIGADO no Supabase: assim o signUp cria o
// usuário, dispara o email de validação e NÃO troca a sessão atual do
// admin. A flag de admin não vai pela metadata (que o usuário poderia
// forjar) — é gravada na tabela profiles por quem está logado (o admin).
export async function signUp(
  name: string,
  email: string,
  password: string,
  isAdmin: boolean,
): Promise<{ ok: boolean; error?: string }> {
  // Após confirmar o email, o Supabase manda o usuário pra esta URL.
  // Precisa estar na allowlist de "Redirect URLs" do projeto Supabase.
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: error.message };

  // Se o admin marcou "Administrador", promove o profile recém-criado
  // pelo trigger. Roda na sessão do admin (preservada), então o RLS
  // "profiles_update_admin" permite.
  if (isAdmin && data.user?.id) {
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", data.user.id);
    if (upErr)
      return {
        ok: false,
        error: `Usuário criado, mas falhou ao marcar como admin: ${upErr.message}`,
      };
  }
  return { ok: true };
}

// O usuário logado é administrador? Usado pra proteger o painel.
// Se a tabela profiles ainda não existir (migração não rodada), não
// trava ninguém — devolve true até o schema estar no ar.
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", uid)
    .maybeSingle();
  if (error) {
    // 42P01 = tabela inexistente (migração ainda não rodada) → libera.
    if ((error as { code?: string }).code === "42P01") return true;
    return false;
  }
  return data?.is_admin === true;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

// Nome do usuário logado (vem da metadata gravada no signUp). Cai para
// o email se o nome não tiver sido informado.
export async function getCurrentName(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const name = (user.user_metadata?.name as string | undefined)?.trim();
  return name || user.email || null;
}

export async function isAuthed(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

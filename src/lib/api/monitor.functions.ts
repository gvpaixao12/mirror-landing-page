import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ServerStats } from "./monitor.server";

export type { ServerStats, Pm2Proc } from "./monitor.server";

// Métricas do servidor pro painel "Servidor" do CRM.
// O cliente manda o access token da sessão Supabase; aqui validamos o
// token e checamos profiles.is_admin (com RLS, na sessão do próprio
// usuário) antes de expor qualquer dado da máquina.
export const getServerStats = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }): Promise<ServerStats> => {
    const sb = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${data.token}` } },
      },
    );
    const { data: u, error } = await sb.auth.getUser(data.token);
    if (error || !u.user) throw new Error("Não autenticado");
    const { data: profile } = await sb
      .from("profiles")
      .select("is_admin")
      .eq("id", u.user.id)
      .maybeSingle();
    if (profile?.is_admin !== true) throw new Error("Acesso restrito a administradores");

    // Import dinâmico: módulos node:* só carregam no runtime Node da VPS.
    const { collectServerStats } = await import("./monitor.server");
    return collectServerStats();
  });

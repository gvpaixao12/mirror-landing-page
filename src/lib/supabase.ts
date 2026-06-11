import { createClient } from "@supabase/supabase-js";

// URL e chave anon vêm do .env (VITE_*). São públicas por design — a
// segurança real fica no RLS (no banco) + Supabase Auth.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

-- ============================================================
-- ProductLab CRM — schema inicial
-- Tabelas: leads, forms  +  RLS (segurança por linha)
-- ============================================================

-- ---------- LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text default '',
  email text default '',
  stage text not null default 'Novo'
    check (stage in ('Novo','Qualificação','Reunião','Proposta','Negociação','Ganho','Perdido')),
  value numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- FORMS (briefing público) ----------
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text default '',
  message text default '',
  payload jsonb default '{}'::jsonb,
  is_new boolean not null default true,
  status text not null default 'novo' check (status in ('novo','convertido','arquivado')),
  created_at timestamptz not null default now()
);

-- ---------- CLIENTES ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  city text default '',
  uf text default '',
  created_at timestamptz not null default now()
);

-- ---------- PROPOSTAS ----------
create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_name text not null,
  company text default '',
  value numeric not null default 0,
  status text not null default 'Rascunho'
    check (status in ('Rascunho','Enviada','Aceita','Recusada')),
  content jsonb not null default '{}'::jsonb,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bancos criados antes da coluna lead_id (vínculo proposta ↔ lead do funil)
alter table public.propostas
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

-- ---------- PROFILES (perfil + flag de admin) ----------
-- Espelha auth.users e guarda quem é administrador. O is_admin NÃO vem
-- da metadata do usuário (que é editável por ele) — só um admin pode
-- promover/rebaixar via a policy de update abaixo.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  email text default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Função helper: o usuário atual é admin?
-- security definer + search_path fixo: roda com privilégios do dono e
-- evita recursão de RLS (lê profiles sem reaplicar a policy).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Cria o profile automaticamente quando um usuário novo nasce no Auth.
-- is_admin sempre começa false (segurança); admin promove depois.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, is_admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: cria profile pros usuários que já existiam antes do trigger.
insert into public.profiles (id, name, email, is_admin)
select id, coalesce(raw_user_meta_data->>'name', ''), email, false
from auth.users
on conflict (id) do nothing;

-- >>> IMPORTANTE: marque seu(s) usuário(s) admin (troque o email):
update public.profiles set is_admin = true
where email = 'admin@productlab.local';

-- ---------- RLS ----------
alter table public.leads enable row level security;
alter table public.forms enable row level security;
alter table public.propostas enable row level security;
alter table public.clientes enable row level security;
alter table public.profiles enable row level security;

-- Profiles: cada um lê o próprio; admin lê todos. Só admin altera/insere.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated with check (public.is_admin());

-- Clientes: somente administradores
drop policy if exists "clientes_auth_all" on public.clientes;
drop policy if exists "clientes_admin_all" on public.clientes;
create policy "clientes_admin_all" on public.clientes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Propostas: somente administradores
drop policy if exists "propostas_auth_all" on public.propostas;
drop policy if exists "propostas_admin_all" on public.propostas;
create policy "propostas_admin_all" on public.propostas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Leads: somente administradores
drop policy if exists "leads_auth_all" on public.leads;
drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all" on public.leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Forms: qualquer visitante pode ENVIAR (briefing público).
-- Ler/editar/apagar só administrador.
drop policy if exists "forms_insert_public" on public.forms;
create policy "forms_insert_public" on public.forms
  for insert to anon, authenticated with check (true);

drop policy if exists "forms_select_auth" on public.forms;
drop policy if exists "forms_select_admin" on public.forms;
create policy "forms_select_admin" on public.forms
  for select to authenticated using (public.is_admin());

drop policy if exists "forms_update_auth" on public.forms;
drop policy if exists "forms_update_admin" on public.forms;
create policy "forms_update_admin" on public.forms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "forms_delete_auth" on public.forms;
drop policy if exists "forms_delete_admin" on public.forms;
create policy "forms_delete_admin" on public.forms
  for delete to authenticated using (public.is_admin());

-- ---------- Semente (só se vazio) ----------
insert into public.leads (name, company, email, stage, value)
select 'Marina Tavares', 'Distribuidora XYZ', 'marina@xyz.com.br', 'Qualificação', 0
where not exists (select 1 from public.leads);

insert into public.forms (name, email, company, message, is_new)
select * from (values
  ('João Pereira', 'joao@empresa.com', '', 'Quero um portal pros representantes verem comissão em tempo real.', true),
  ('Carla Souza', 'carla@loja.com.br', '', 'Preciso integrar Bling + planilhas num painel só.', false)
) as v(name, email, company, message, is_new)
where not exists (select 1 from public.forms);

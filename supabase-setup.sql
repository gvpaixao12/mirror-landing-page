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
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.leads enable row level security;
alter table public.forms enable row level security;
alter table public.propostas enable row level security;

-- Propostas: somente usuários autenticados (equipe logada)
drop policy if exists "propostas_auth_all" on public.propostas;
create policy "propostas_auth_all" on public.propostas
  for all to authenticated using (true) with check (true);

-- Leads: somente usuários autenticados (equipe logada)
drop policy if exists "leads_auth_all" on public.leads;
create policy "leads_auth_all" on public.leads
  for all to authenticated using (true) with check (true);

-- Forms: qualquer visitante pode ENVIAR (briefing público).
-- Ler/editar/apagar só autenticado.
drop policy if exists "forms_insert_public" on public.forms;
create policy "forms_insert_public" on public.forms
  for insert to anon, authenticated with check (true);

drop policy if exists "forms_select_auth" on public.forms;
create policy "forms_select_auth" on public.forms
  for select to authenticated using (true);

drop policy if exists "forms_update_auth" on public.forms;
create policy "forms_update_auth" on public.forms
  for update to authenticated using (true) with check (true);

drop policy if exists "forms_delete_auth" on public.forms;
create policy "forms_delete_auth" on public.forms
  for delete to authenticated using (true);

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

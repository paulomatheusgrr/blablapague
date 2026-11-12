-- BlaBlaPague multi-tenant — Fase 0: tabela de motoristas + RLS + auth triggers
-- Aplicar no projeto Supabase dedicado (via MCP apply_migration ou SQL editor).

-- 1) Tabela: 1 linha por motorista, atrelada ao usuário do Supabase Auth.
create table if not exists public.drivers (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  pix_key        text,
  merchant_name  text    not null default 'MOTORISTA',
  merchant_city  text    not null default 'SAO PAULO',
  valor_padrao   numeric not null default 25,
  carro_modelo   text,
  carro_cor      text,
  carro_placa    text,
  slug           text unique,                 -- link público opcional do kiosk (futuro)
  config         jsonb   not null default '{}'::jsonb,  -- flags: zoom, volume, propaganda, jogo…
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.drivers is 'Configuração por motorista (SaaS). A chave PIX é de recebimento e é entregue ao kiosk do próprio motorista.';

-- 2) RLS: cada motorista só enxerga/edita a PRÓPRIA linha.
alter table public.drivers enable row level security;

drop policy if exists drivers_select_own on public.drivers;
create policy drivers_select_own on public.drivers
  for select using (auth.uid() = id);

drop policy if exists drivers_insert_own on public.drivers;
create policy drivers_insert_own on public.drivers
  for insert with check (auth.uid() = id);

drop policy if exists drivers_update_own on public.drivers;
create policy drivers_update_own on public.drivers
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 3) updated_at automático.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists drivers_touch_updated_at on public.drivers;
create trigger drivers_touch_updated_at
  before update on public.drivers
  for each row execute function public.touch_updated_at();

-- 4) Ao cadastrar (signup), cria a linha do motorista automaticamente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.drivers (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

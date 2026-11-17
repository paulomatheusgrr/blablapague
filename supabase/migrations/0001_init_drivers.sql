-- BlaBlaPague multi-tenant — Fase 0
-- Schema ISOLADO dentro do projeto compartilhado (não mexe nas tabelas do `public`).
-- Aplicado no projeto Supabase `vendas-unificadas` (ref aplhxqxhffceqiyquqtk).

-- 1) Schema próprio do produto.
create schema if not exists blablapague;
grant usage on schema blablapague to authenticated, service_role;

-- 2) Tabela: 1 linha por motorista, atrelada ao usuário do Supabase Auth.
create table if not exists blablapague.drivers (
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

comment on table blablapague.drivers is 'Config por motorista (SaaS). A chave PIX é de recebimento e é entregue ao kiosk do próprio motorista.';

-- 3) RLS: cada motorista só enxerga/edita a PRÓPRIA linha.
alter table blablapague.drivers enable row level security;
grant select, insert, update, delete on blablapague.drivers to authenticated;

create policy drivers_select_own on blablapague.drivers
  for select using (auth.uid() = id);
create policy drivers_insert_own on blablapague.drivers
  for insert with check (auth.uid() = id);
create policy drivers_update_own on blablapague.drivers
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 4) updated_at automático (search_path travado — aviso 0011 do linter).
create or replace function blablapague.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger drivers_touch_updated_at
  before update on blablapague.drivers
  for each row execute function blablapague.touch_updated_at();

-- 5) Ao cadastrar (signup), cria a linha do motorista automaticamente.
create or replace function blablapague.handle_new_user()
returns trigger language plpgsql security definer set search_path = blablapague, public as $$
begin
  insert into blablapague.drivers (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_blablapague
  after insert on auth.users
  for each row execute function blablapague.handle_new_user();

-- 6) Expor o schema na API (rodar como statement solto; não faz parte do DDL):
--    alter role authenticator set pgrst.db_schemas = 'public, graphql_public, blablapague';
--    notify pgrst, 'reload config';

-- Fase 2: ingestão de viagens por motorista (e-mail → Edge Function → Supabase)
-- Aplicado no projeto `vendas-unificadas` (ref aplhxqxhffceqiyquqtk).

-- 1) Token secreto de ingestão + viagem atual, por motorista.
alter table blablapague.drivers
  add column if not exists ingest_token   text,
  add column if not exists current_trip   jsonb,
  add column if not exists trip_updated_at timestamptz;

update blablapague.drivers
  set ingest_token = substr(md5(random()::text || clock_timestamp()::text), 1, 10)
  where ingest_token is null;

alter table blablapague.drivers
  alter column ingest_token set default substr(md5(random()::text || clock_timestamp()::text), 1, 10);

create unique index if not exists drivers_ingest_token_key on blablapague.drivers(ingest_token);

-- 2) E-mails brutos por motorista (só service_role acessa; sem policies).
create table if not exists blablapague.emails (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references blablapague.drivers(id) on delete cascade,
  received_at timestamptz not null default now(),
  mail_from   text,
  subject     text,
  body_text   text,
  body_html   text
);
create index if not exists emails_driver_idx on blablapague.emails(driver_id, received_at);
alter table blablapague.emails enable row level security;

-- 3) Kiosk lê a viagem atual do motorista por código (anon, sem login).
create or replace function blablapague.kiosk_trip_by_slug(p_slug text)
returns jsonb language sql security definer set search_path = blablapague, public stable as $$
  select current_trip from blablapague.drivers where slug = nullif(trim(p_slug), '') limit 1;
$$;
revoke all on function blablapague.kiosk_trip_by_slug(text) from public;
grant execute on function blablapague.kiosk_trip_by_slug(text) to anon, authenticated;

-- 4) A Edge Function usa service_role (grants explícitos em schema customizado).
grant all on all tables in schema blablapague to service_role;
grant all on all sequences in schema blablapague to service_role;
alter default privileges in schema blablapague grant all on tables to service_role;
alter default privileges in schema blablapague grant all on sequences to service_role;

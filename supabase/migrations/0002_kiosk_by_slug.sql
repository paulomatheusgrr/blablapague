-- BlaBlaPague — Fase 1.5: kiosk público por código (slug)
-- O carro abre o kiosk SEM login, lendo a config pelo código. Só os campos do
-- kiosk são expostos (nunca o e-mail), e exige o código exato (sem listagem).
-- Aplicado no projeto `vendas-unificadas` (ref aplhxqxhffceqiyquqtk).

grant usage on schema blablapague to anon;

create or replace function blablapague.kiosk_by_slug(p_slug text)
returns table (
  pix_key       text,
  merchant_name text,
  merchant_city text,
  valor_padrao  numeric,
  carro_modelo  text,
  carro_cor     text,
  carro_placa   text,
  config        jsonb
)
language sql security definer set search_path = blablapague, public stable as $$
  select pix_key, merchant_name, merchant_city, valor_padrao,
         carro_modelo, carro_cor, carro_placa, config
  from blablapague.drivers
  where slug = nullif(trim(p_slug), '')
  limit 1;
$$;

revoke all on function blablapague.kiosk_by_slug(text) from public;
grant execute on function blablapague.kiosk_by_slug(text) to anon, authenticated;

# 🏢 BlaBlaPague Multi-Tenant (SaaS) — Arquitetura

Transformação do kiosk single-user num **produto multi-motorista**: qualquer
motorista se cadastra com o e-mail, configura a própria chave PIX / carro /
valores, e recebe o próprio kiosk. O PIX continua sendo gerado **no navegador**
(nenhuma chave PIX passa pelo nosso servidor além de ficar salva na config do
motorista).

## Visão geral

```
Motorista  ──(e-mail, magic link)──►  Supabase Auth
    │
    ▼
Supabase DB  ·  tabela `drivers` (1 linha por motorista, RLS)
    │   pix_key, merchant_name, merchant_city, valor_padrao,
    │   carro_modelo/cor/placa, slug público, flags…
    ▼
Admin (admin.html)  ──►  login + formulário que grava em `drivers`
Kiosk (index.html)  ──►  lê a config do motorista logado  +  gera PIX no browser
    │
    ▼
Viagens:  Fase 1 = manuais no Admin   ·   Fase 2 = automação de e-mail por motorista
```

## Decisões

| Tema | Escolha | Porquê |
|------|---------|--------|
| Backend | **Supabase** (Postgres + Auth + RLS) | Já conectado; auth por e-mail pronta; RLS isola cada motorista |
| Login | **Magic link (OTP por e-mail)** | Sem senha; combina com "cadastra com o e-mail" |
| PIX | **Client-side** (`js/pix.js`) | Não precisamos tocar em dinheiro; zero PCI |
| Hospedagem front | Estática (Hostinger/Netlify/Vercel) | O app já é estático |
| Viagens (MVP) | **Manuais no Admin** | Funciona pra qualquer motorista no dia 1 |
| Viagens (depois) | Automação de e-mail por motorista | O n8n atual é single-inbox; generalizar é Fase 2 |

## Modelo de dados (público)

`public.drivers`
- `id uuid` PK — **=** `auth.users.id`
- `email text`
- `pix_key text`, `merchant_name text`, `merchant_city text`
- `valor_padrao numeric`
- `carro_modelo text`, `carro_cor text`, `carro_placa text`
- `slug text unique` — link público opcional (`/d/<slug>`)
- `config jsonb` — demais flags (zoom, volume, propaganda, jogo…)
- `created_at`, `updated_at`

**RLS:** cada motorista só lê/escreve a própria linha (`auth.uid() = id`).
Leitura pública (anon) só por `slug`, e **sem** expor a chave PIX? → A chave PIX
precisa ir pro navegador pra gerar o QR, então ela é "pública por natureza" no
kiosk daquele motorista. Mantemos assim (é uma chave de recebimento, não um
segredo). Nada de dados de passageiros no servidor por enquanto.

## Onde roda (Supabase)

Para reaproveitar a conta, o backend vive num **schema isolado `blablapague`**
dentro do projeto **`vendas-unificadas`** (ref `aplhxqxhffceqiyquqtk`,
`https://aplhxqxhffceqiyquqtk.supabase.co`) — separado das tabelas de vendas, com
RLS próprio. O schema é exposto na API junto de `public` e `graphql_public`. No
client, acessa-se com `supabase.schema('blablapague')`.

## Fases

- **Fase 0 — Fundação** *(✅ feito)*: schema `blablapague`, tabela `drivers`,
  RLS own-row, trigger de updated_at e criação automática da linha no signup.
- **Fase 1 — MVP multi-user**: tela de login/cadastro, Admin grava no Supabase,
  kiosk lê a config do motorista logado, viagens manuais. ➡️ **shippable**.
- **Fase 2 — Automação por motorista**: cada motorista pluga o próprio e-mail
  (encaminhamento pra um endereço único ou OAuth) e o parser roda por tenant.
- **Fase 3 — Produto pago**: planos/cobrança (Stripe ou Mercado Pago), limites,
  painel do dono.

## Config do front

`js/config.js` (fora do Git) passa a conter só as chaves **públicas** do
Supabase do projeto:

```js
window.BLABLA_CONFIG = {
  supabaseUrl: 'https://aplhxqxhffceqiyquqtk.supabase.co',
  supabaseAnonKey: 'sb_publishable_ak51E4zYwzqmaFoLLqtpcA_vlHY1gDx' // publicável
};
```

`js/store.js` passa a ler a config do motorista do Supabase (com cache em
`localStorage` pra funcionar offline durante a viagem).

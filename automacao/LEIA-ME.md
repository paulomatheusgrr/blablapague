# Importar da BlaBlaCar & confirmação automática

## Importar a viagem — use o "Botão Mágico" (bookmarklet) ✅

A forma que **funciona** de trazer os passageiros e a rota da BlaBlaCar é o
**botão mágico**, que roda no seu navegador normal (logado do seu jeito).
Abra **[`bookmarklet.html`](../bookmarklet.html)** e siga as instruções lá.

Fluxo por viagem:
1. Faça login na BlaBlaCar no seu navegador e abra o **"Resumo da viagem"**.
2. Clique no favorito **🪄 Capturar viagem** → baixa `viagem-blablacar.json`.
3. No kiosk, abra o **⚙️ Admin › "Importar JSON"** e escolha o arquivo.
4. Ajuste o **valor** de cada passageiro e **Salve**.

> **Por que não é um robô 100% automático?** Tentamos automatizar o login com
> um navegador controlado (Playwright), mas a BlaBlaCar usa proteção anti-robô
> (DataDome) que **bloqueia** navegadores automatizados ("acesso temporariamente
> restrito"). Forçar isso é frágil, vai contra os Termos deles e marca seu IP.
> O botão mágico evita tudo isso: é você navegando de verdade + um clique.
> Fica "quase automático": um clique para capturar, um clique para importar.

O Node.js/Playwright foram instalados durante a construção. Para o uso diário do
botão mágico **você não precisa deles** — o kiosk é 100% estático.

---

## Modelo B — Confirmação de pagamento automática (opcional, precisa de Node)

Hoje (Modelo A) alguém toca em "Já paguei". Para o tablet marcar "pago"
**sozinho** no instante do pagamento, é preciso uma **cobrança PIX dinâmica** de
um provedor que avisa o app.

1. Conta num provedor com API de PIX (aceitam CPF/pessoa física):
   - **Efí (ex-Gerencianet)** — https://dev.efipay.com.br
   - **Mercado Pago** — https://www.mercadopago.com.br/developers
   - **Asaas** — https://docs.asaas.com
2. Um pequeno **backend** (Node) cria uma cobrança única por passageiro (QR
   dinâmico com `txid` próprio) e recebe o aviso de pagamento (webhook) ou
   consulta o status.
3. No `js/app.js`, veja o comentário `// [MODELO B]` em `abrirPagamento`: é ali
   que o app pediria o QR dinâmico e passaria a confirmar sozinho.

> Quando quiser esse passo, me chame que eu monto o backend + a integração com o
> provedor que você escolher.

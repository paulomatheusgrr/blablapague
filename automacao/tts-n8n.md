# Voz "mãos livres" dos nomes (TTS via n8n)

No Android, o Chrome só deixa a voz do navegador falar quando vem de um toque.
Como o anúncio é disparado pelo GPS, a voz não sai sozinha. A solução é o n8n
gerar um **MP3 da frase** e o kiosk tocar esse áudio pelo mesmo caminho do chime
(AudioContext), que fica **liberado a viagem toda após 1 toque** → mãos livres.

## 1) Importar o fluxo
- No n8n: **Workflows → Import from File** → `n8n-workflow-tts.json`.
- Abra o node **"Webhook TTS"** e copie a **Production URL** (algo como
  `https://n8n.safepointmarket.com.br/webhook/tts-blablacar`).
- **Salve** e **ative** o workflow (toggle "Active").

## 2) Apontar o kiosk pro endpoint
No `js/config.js` (no servidor), preencha:

```js
ttsUrl: 'https://n8n.safepointmarket.com.br/webhook/tts-blablacar',
```

Suba o `config.js` e o `js/app.js` (com `?v=` novo). Pronto: na 1ª vez que
tocar na tela (o mesmo toque da tela cheia), a voz passa a sair sozinha em
cada cidade.

## Como funciona o fluxo
`Webhook (GET ?text=...)` → `HTTP Request` (Google Translate TTS, com
User-Agent de navegador) → `Responder MP3 + CORS` (devolve o áudio com
`Access-Control-Allow-Origin: *` e `Content-Type: audio/mpeg`).

O kiosk chama `GET <ttsUrl>?text=<frase>` e toca o MP3 retornado.

## Testar rápido
Abra no navegador (troque o domínio):
`https://SEU-N8N/webhook/tts-blablacar?text=Embarque%20em%20São%20Manuel.%20Bruna`
Deve **baixar/tocar um MP3** com a frase. Se tocar, o kiosk vai falar sozinho.

## Observações / limites
- O Google TTS aceita ~**200 caracteres** por chamada. Os anúncios são curtos
  (nome + cidade), então cabe numa chamada só.
- É um endpoint **não oficial** do Google. Para baixo volume (algumas chamadas
  por viagem) costuma funcionar bem. Se um dia o Google bloquear (erro 403/429
  no node "Google TTS"), dá pra trocar por um TTS com chave (ex.: Google Cloud
  Text-to-Speech, VoiceRSS) — é só mudar o node HTTP Request; o resto do fluxo
  e o kiosk continuam iguais.
- Se o `ttsUrl` ficar vazio ou o endpoint falhar, o kiosk **cai na voz do
  navegador** automaticamente (reserva).
- Voz/idioma: `tl=pt-BR`. Para voz diferente, troque `tl` (não há escolha de
  timbre nesse endpoint do Google).

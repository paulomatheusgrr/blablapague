# Confirmar viagem → WhatsApp (n8n + Evolution API)

Quando você clica em **📲 Confirmar viagem** no Admin, o app faz um **POST** no
seu **webhook do n8n** com o pacote abaixo. O n8n percorre os passageiros e envia
a mensagem via **Evolution API**. A chave do Evolution fica **só no n8n**.

## 1) O que o app envia (POST no webhook)

`Content-Type: application/json`

```json
{
  "acao": "confirmar_viagem",
  "viagem": {
    "origem": "São Paulo",
    "destino": "Campinas",
    "dataHora": "2026-08-17T14:00",
    "paradas": ["São Paulo", "Jundiaí", "Valinhos", "Campinas"],
    "carro": { "modelo": "Fiat Argo", "cor": "prata", "placa": "ABC1D23" }
  },
  "passageiros": [
    {
      "nome": "Ana Souza",
      "telefone": "5511999990001",
      "telefoneOriginal": "+55 11 99999-0001",
      "embarque": "São Paulo",
      "destino": "Jundiaí",
      "valor": 25,
      "mensagem": "Olá, Ana! 🚗✨\n\nSua viagem está *CONFIRMADA*! ..."
    }
  ]
}
```

- `telefone` já vem **só com dígitos** (formato Evolution: país+DDD+número, ex.: `5511999990001`).
- `mensagem` já vem **pronta e personalizada** — o n8n só precisa enviar esse texto.
- Só entram passageiros **com telefone válido** (≥ 10 dígitos).

## 2) Fluxo no n8n (3 nós)

1. **Webhook** (POST) — copie a *Production URL* dele e cole no Admin (campo "Webhook do n8n").
2. **Split Out** — campo a separar: `passageiros` (gera 1 item por passageiro).
3. **HTTP Request** — envia no Evolution API:
   - **Method:** POST
   - **URL:** `https://SEU-EVOLUTION/message/sendText/SUA-INSTANCIA`
   - **Headers:** `apikey: SUA_API_KEY` e `Content-Type: application/json`
   - **Body (JSON):**
     ```json
     { "number": "={{ $json.telefone }}", "text": "={{ $json.mensagem }}" }
     ```

> Alguns Evolution usam `{"number","text"}` (v2) e outros `{"number","textMessage":{"text"}}`.
> Confira a doc da sua versão e ajuste o Body.

## 3) CORS (importante)

O app roda no navegador; se o webhook não devolver cabeçalhos CORS, o POST **chega
ao n8n** mas o app **não consegue ler a resposta** (mostra "enviado, sem confirmação").
Para ter confirmação verde, no n8n use um nó **"Respond to Webhook"** devolvendo, por
exemplo, `{"ok":true}` com o header `Access-Control-Allow-Origin: *`.

## 4) Exemplo de workflow para importar no n8n

Ajuste a URL/instância/apikey do Evolution. No n8n: *Workflows → Import from clipboard*.

```json
{
  "name": "BlaBlaPague - Confirmar viagem",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "confirmar-viagem", "responseMode": "responseNode" },
      "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
      "position": [260, 300], "webhookId": "confirmar-viagem"
    },
    {
      "parameters": { "fieldToSplitOut": "body.passageiros", "options": {} },
      "name": "Split Out passageiros", "type": "n8n-nodes-base.splitOut", "typeVersion": 1,
      "position": [520, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://SEU-EVOLUTION/message/sendText/SUA-INSTANCIA",
        "sendHeaders": true,
        "headerParameters": { "parameters": [ { "name": "apikey", "value": "SUA_API_KEY" } ] },
        "sendBody": true, "specifyBody": "json",
        "jsonBody": "={\n  \"number\": \"{{ $json.telefone }}\",\n  \"text\": {{ JSON.stringify($json.mensagem) }}\n}",
        "options": {}
      },
      "name": "Evolution sendText", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
      "position": [780, 300]
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={ \"ok\": true }",
        "options": { "responseHeaders": { "entries": [ { "name": "Access-Control-Allow-Origin", "value": "*" } ] } } },
      "name": "Responder", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1,
      "position": [1040, 300]
    }
  ],
  "connections": {
    "Webhook": { "main": [ [ { "node": "Split Out passageiros", "type": "main", "index": 0 } ] ] },
    "Split Out passageiros": { "main": [ [ { "node": "Evolution sendText", "type": "main", "index": 0 } ] ] },
    "Evolution sendText": { "main": [ [ { "node": "Responder", "type": "main", "index": 0 } ] ] }
  }
}
```

> Dependendo da versão do n8n, o campo pode ser `passageiros` em vez de `body.passageiros`
> (quando o Webhook entrega o corpo direto). Se o Split Out não achar, teste os dois.

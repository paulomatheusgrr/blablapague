# Sincronização automática: E-mail → n8n → kiosk (pronto pro seu setup)

Os passageiros aparecem no tablet **sozinhos**. Cada consulta do kiosk faz o n8n
**ler seus e-mails da BlaBlaCar**, remontar a viagem (somando reservas, tirando
cancelamentos) e devolver. **Sem banco de dados** — o Gmail é a fonte da verdade.

```
Kiosk (consulta a cada 30s)  ─►  n8n Webhook GET  ─►  Gmail (lê e-mails)  ─►  Code (parser)  ─►  Respond (JSON+CORS)
```

## Formato real dos e-mails (de `hello@blablacar.com`)

**Reserva** (assunto "Novo passageiro para …"):
```
Gih acabou de reservar um lugar para viajar com você!
quinta-feira, 20 de agosto de 2026 05:20
R. das Festas... Bauru - SP, Bauru - Parque das Cascatas, Botucatu - SP, Botucatu
Gih   4,5/5 – 28 avaliações
2 lugares
Dinheiro R$ 44,00
Ver reserva  https://...id=019fa839-...
```
**Cancelamento** (assunto "Cancelamento da carona para …"):
```
Tayná precisou cancelar. O lugar está disponível novamente.
1 lugar
21/08/2026
R. Emílio Cani... Botucatu - SP, Botucatu - Av. Nações Unidas... Bauru - SP, Bauru
```
Dá pra extrair: **nome, data/hora, embarque→destino, nº de lugares e valor**.
⚠️ **Não vem telefone nem foto** por e-mail (foto → iniciais; telefone → só pelo
botão mágico/manual, se você for usar o WhatsApp).

## Opção A (recomendada): importar o workflow pronto

Já deixei o workflow inteiro montado em **`n8n-workflow-coleta.json`** (nesta pasta).

1. No n8n: **Workflows → ⋯ (menu) → Import from File** e escolha `n8n-workflow-coleta.json`.
2. Abra o nó **"Gmail - ler e-mails"** e selecione a sua **credencial do Google** (OAuth).
   - Confirme que **"Simplify" está desligado** (precisamos do corpo em texto).
3. **Salve e ative** o workflow.
4. Abra o nó **Webhook** e copie a *Production URL*; cole no **Admin do kiosk → 🔄 Sincronização automática**.

> Como esse import cria um workflow novo, a URL do webhook será nova (path `coleta-blablacar-kiosk`).
> Se preferir manter seu workflow atual, siga a Opção B abaixo.

## Opção B (manual): montar no seu workflow "Coleta blablacar"

O Webhook já existe. Faltam 3 ajustes/nós:

1. **Webhook** (já tem): em *Response* → **Respond Mode = "Using 'Respond to Webhook' node"**.
   - URL pro Admin: `https://n8n.safepointmarket.com.br/webhook/43db7907-d797-4eed-bef9-ce956837a6c2`

2. **Gmail → Get Many messages**:
   - *Search:* `from:hello@blablacar.com newer_than:14d`
   - *Return All:* ligado (ou Limit 100)
   - *Simplify:* **desligado** (precisamos do corpo em texto no campo `text`).

3. **Code** (JavaScript, "Run Once for All Items") — cole o código da seção abaixo.

4. **Respond to Webhook**:
   - *Respond With:* **JSON** → `{{ $json }}`
   - *Response Headers:* adicione `Access-Control-Allow-Origin: *`
     (sem isso, o navegador do tablet não lê a resposta).

Ligue: **Webhook → Gmail → Code → Respond to Webhook**. Ative o workflow.

No **Admin do kiosk** → 🔄 Sincronização automática → cole a URL do Webhook. Pronto.

## Código do nó "Code"

```javascript
// Remonta a próxima viagem a partir dos e-mails da BlaBlaCar.
const ORDEM = ['Botucatu', 'São Manuel', 'Lençóis Paulista', 'Agudos', 'Bauru']; // ordem da rota
const MESES = { janeiro:1, fevereiro:2, 'março':3, marco:3, abril:4, maio:5, junho:6, julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };
const norm = (s) => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const idxCidade = (c) => { const n = norm(c); let r = 99; ORDEM.forEach((o,i)=>{ if (norm(o)===n) r = i; }); return r; };
const corpo = (j) => j.text || j.textPlain || j.snippet || j.body || '';

// Trajeto pelas cidades conhecidas (robusto a paradas sem "- SP", tipo pontos/landmarks):
// embarque = primeira cidade (mais à esquerda); destino = última (mais à direita)
function parseRota(t) {
  let melhor = '', qtd = 0;
  for (const l of t.split('\n')) {
    const nl = norm(l);
    const c = ORDEM.filter(city => nl.includes(norm(city))).length;
    if (c > qtd) { qtd = c; melhor = l; }
  }
  const nl = norm(melhor);
  let emb = '', embPos = 1e9, dest = '', destPos = -1;
  ORDEM.forEach(city => {
    const nc = norm(city);
    const f = nl.indexOf(nc), g = nl.lastIndexOf(nc);
    if (f > -1 && f < embPos) { embPos = f; emb = city; }
    if (g > -1 && g > destPos) { destPos = g; dest = city; }
  });
  return { embarque: emb, destino: dest };
}
function parseData(t) {
  const p = (x) => String(x).padStart(2,'0');
  let m = t.match(/(\d{1,2}) de ([A-Za-zçÇ]+) de (\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (m && MESES[norm(m[2])]) { const dia = `${m[3]}-${p(MESES[norm(m[2])])}-${p(m[1])}`; return { dia, iso: dia + (m[4] ? `T${p(m[4])}:${p(m[5])}` : '') }; }
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) { const dia = `${m[3]}-${p(m[2])}-${p(m[1])}`; return { dia, iso: dia }; }
  return { dia:'', iso:'' };
}

// Foto do passageiro (vem no HTML do e-mail; quem não tem cai nas iniciais)
function parseFoto(j) {
  const h = j.html || j.textAsHtml || '';
  const m = h.match(/https:\/\/cdn\.blablacar\.com\/user-profile-picture\/[A-Za-z0-9]+\/thumbnail_144x144\.jpe?g/i);
  return m ? m[0] : '';
}

const msgs = $input.all().map(i => i.json)
  .sort((a,b) => new Date(a.date||a.internalDate||0) - new Date(b.date||b.internalDate||0));

const registros = [];
const chave = (r) => norm(r.nome)+'|'+r.dia+'|'+norm(r.embarque)+'|'+norm(r.destino);
for (const j of msgs) {
  const t = corpo(j);
  const reserva = /acabou de reservar um lugar/.test(t);
  const cancel = /precisou cancelar/.test(t);
  if (!reserva && !cancel) continue;
  const nome = (reserva ? t.split('acabou de reservar')[0] : t.split('precisou cancelar')[0] || '').trim().replace(/\s+/g,' ');
  const { dia, iso } = parseData(t);
  const { embarque, destino } = parseRota(t);
  if (!nome || !dia || !embarque || !destino) continue;
  const dir = idxCidade(embarque) <= idxCidade(destino) ? 'F' : 'B';
  const reg = { nome, dia, iso, embarque, destino, grupo: dia + '|' + dir };
  for (let i = registros.length-1; i>=0; i--) if (chave(registros[i]) === chave(reg)) registros.splice(i,1);
  if (reserva) {
    const v = t.match(/R\$\s*([\d.,]+)/);
    reg.valor = v ? Number(v[1].replace(/\./g,'').replace(',', '.')) : null;
    reg.foto = parseFoto(j);
    registros.push(reg);
  }
}

// Agrupa por VIAGEM = dia + sentido (F/B). Assim todos os embarques da mesma
// viagem (17:10, 17:30, 17:50...) ficam juntos, em vez de virar viagens separadas.
const grupos = {};
for (const r of registros) (grupos[r.grupo] = grupos[r.grupo] || []).push(r);
const saidaDe = (g) => grupos[g].map(r => r.iso).sort()[0];

// Próxima viagem: a de saída mais próxima que ainda não passou (3h de tolerância)
const agora = Date.now();
const chaves = Object.keys(grupos).filter(g => saidaDe(g)).sort((a,b) => saidaDe(a).localeCompare(saidaDe(b)));
let escolhida = chaves.find(g => new Date(saidaDe(g)).getTime() >= agora - 3*3600*1000) || chaves[chaves.length-1];
const pax = escolhida ? grupos[escolhida] : [];

const forward = pax.length ? idxCidade(pax[0].embarque) <= idxCidade(pax[0].destino) : true;
const cidades = [...new Set(pax.flatMap(r => [r.embarque, r.destino]))]
  .sort((a,b) => forward ? idxCidade(a)-idxCidade(b) : idxCidade(b)-idxCidade(a));

const trip = {
  origem: cidades[0] || '',
  destino: cidades[cidades.length-1] || '',
  dataHora: escolhida ? saidaDe(escolhida) : '',
  paradas: cidades.map(nome => ({ nome, foto: '' })),
  passageiros: pax.map((r,i) => ({ id:'p'+(i+1), nome:r.nome, foto:r.foto||'', embarque:r.embarque, destino:r.destino, valor:r.valor, telefone:'', status:'pendente', pagoEm:null }))
};

return [{ json: { trip } }];
```

## Testar
1. Salve/ative o workflow. Abra a URL do Webhook no navegador → deve devolver um JSON `{ "trip": {...} }` com a **próxima** viagem.
2. No Admin do kiosk, cole a URL no campo de sincronização e salve.
3. Abra o kiosk: em até 30s os passageiros aparecem sozinhos. 🎉

> **Ordem da rota (`ORDEM`)**: ajuste a lista se você rodar outros trajetos, pra
> as paradas/balões ficarem na ordem certa. Se um passageiro tiver cidade fora da
> lista, ela vai pro fim — é só acrescentar na `ORDEM`.

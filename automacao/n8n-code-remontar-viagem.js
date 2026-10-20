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
// A BlaBlaCar manda o cancelamento em MAIS DE UM formato:
//  - "Fulano precisou cancelar. O lugar está disponível novamente."
//  - "Fulano cancelou. Você poderia confirmar o que aconteceu?"
// Detectamos os dois (no corpo E no assunto), senão o passageiro não some.
const RE_RESERVA = /acabou de reservar um lugar/i;
const RE_CANCEL  = /precisou cancelar|\bcancelou\b/i;
for (const j of msgs) {
  const t = corpo(j);
  const assunto = norm(j.subject || (j.headers && j.headers.subject) || '');
  const reserva = RE_RESERVA.test(t) || assunto.includes('novo passageiro');
  const cancel  = !reserva && (RE_CANCEL.test(t) || assunto.includes('cancelamento'));
  if (!reserva && !cancel) continue;
  // Nome: vem no começo do corpo, antes do verbo (reservar/cancelar/cancelou).
  // Remove um eventual "BlaBlaCar " do início (aparece quando só há o snippet).
  const mNome = t.match(/(?:BlaBlaCar\s+)?([^\n]+?)\s+(?:acabou de reservar|precisou cancelar|cancelou)\b/i);
  const nome = (mNome ? mNome[1] : '').replace(/^BlaBlaCar\s+/i, '').trim().replace(/\s+/g,' ');
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
const inicioDe = (g) => grupos[g].map(r => r.iso).sort()[0];   // 1º embarque (saída da viagem)
const fimDe = (g) => grupos[g].map(r => r.iso).sort().pop();   // último embarque (~chegada)

// Os horários da BlaBlaCar são de Brasília (UTC-3). Fixamos o fuso para NÃO depender
// do fuso do servidor do n8n (senão a viagem troca na hora errada, ex.: no meio do trajeto).
const ms = (iso) => new Date(iso + '-03:00').getTime();
const BUFFER = 3 * 3600 * 1000; // mantém a viagem na tela até 3h DEPOIS do último embarque; só então troca

const agora = Date.now();
const ordenados = Object.keys(grupos).filter(g => inicioDe(g)).sort((a, b) => inicioDe(a).localeCompare(inicioDe(b)));
let escolhida =
  ordenados.find(g => agora >= ms(inicioDe(g)) && agora <= ms(fimDe(g)) + BUFFER) || // viagem em andamento (ou recém-terminada)
  ordenados.find(g => ms(inicioDe(g)) > agora) ||                                    // senão, a próxima que ainda vai começar
  ordenados[ordenados.length - 1];                                                   // senão, a última (todas já passaram)
const pax = escolhida ? grupos[escolhida] : [];

const forward = pax.length ? idxCidade(pax[0].embarque) <= idxCidade(pax[0].destino) : true;
const cidades = [...new Set(pax.flatMap(r => [r.embarque, r.destino]))]
  .sort((a,b) => forward ? idxCidade(a)-idxCidade(b) : idxCidade(b)-idxCidade(a));

// Horário (HH:MM) que o carro chega em cada cidade = embarque MAIS CEDO de
// quem sobe ali. Cidade que é só destino (ninguém embarca) fica sem horário.
const hhmm = (iso) => (iso && iso.indexOf('T') >= 0) ? iso.slice(iso.indexOf('T') + 1, iso.indexOf('T') + 6) : '';
const horaCidade = {};
pax.forEach((r) => { if (r.embarque && r.iso && (!horaCidade[r.embarque] || r.iso < horaCidade[r.embarque])) horaCidade[r.embarque] = r.iso; });

const trip = {
  origem: cidades[0] || '',
  destino: cidades[cidades.length-1] || '',
  dataHora: escolhida ? inicioDe(escolhida) : '',
  paradas: cidades.map(nome => ({ nome, foto: '', horario: hhmm(horaCidade[nome]) })),
  passageiros: pax.map((r,i) => ({ id:'p'+(i+1), nome:r.nome, foto:r.foto||'', embarque:r.embarque, destino:r.destino, horario:hhmm(r.iso), valor:r.valor, telefone:'', status:'pendente', pagoEm:null }))
};

return [{ json: { trip } }];
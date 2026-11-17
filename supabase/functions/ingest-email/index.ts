// ingest-email — recebe um e-mail encaminhado (de qualquer provedor de entrada),
// identifica o motorista pelo token do endereço (viagens+TOKEN@dominio), guarda o
// e-mail bruto e reprocessa TODOS os e-mails do motorista pra montar a viagem atual.
//
// Payload normalizado esperado (POST JSON):
//   { to, from, subject, text, html, token? , secret? }
// Segurança: só aceita e-mail da BlaBlaCar; opcionalmente exige INGEST_SECRET.
// Deploy com verify_jwt=false (webhook).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_SECRET = Deno.env.get("INGEST_SECRET") || "";

const MESES: Record<string, number> = { janeiro:1, fevereiro:2, "março":3, marco:3, abril:4, maio:5, junho:6, julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// -------- Parser (portado de automacao/n8n-code-remontar-viagem.js) --------
function remontarViagem(msgsIn: any[], ORDEM: string[]) {
  const idxCidade = (c: string) => { const n = norm(c); let r = 99; ORDEM.forEach((o, i) => { if (norm(o) === n) r = i; }); return r; };
  const corpo = (j: any) => j.text || j.textPlain || j.snippet || j.body || "";
  function parseRota(t: string) {
    let melhor = "", qtd = 0;
    for (const l of t.split("\n")) {
      const nl = norm(l);
      const c = ORDEM.filter((city) => nl.includes(norm(city))).length;
      if (c > qtd) { qtd = c; melhor = l; }
    }
    const nl = norm(melhor);
    let emb = "", embPos = 1e9, dest = "", destPos = -1;
    ORDEM.forEach((city) => {
      const nc = norm(city);
      const f = nl.indexOf(nc), g = nl.lastIndexOf(nc);
      if (f > -1 && f < embPos) { embPos = f; emb = city; }
      if (g > -1 && g > destPos) { destPos = g; dest = city; }
    });
    return { embarque: emb, destino: dest };
  }
  function parseData(t: string) {
    const p = (x: any) => String(x).padStart(2, "0");
    let m = t.match(/(\d{1,2}) de ([A-Za-zçÇ]+) de (\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
    if (m && MESES[norm(m[2])]) { const dia = `${m[3]}-${p(MESES[norm(m[2])])}-${p(m[1])}`; return { dia, iso: dia + (m[4] ? `T${p(m[4])}:${p(m[5])}` : "") }; }
    m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { const dia = `${m[3]}-${p(m[2])}-${p(m[1])}`; return { dia, iso: dia }; }
    return { dia: "", iso: "" };
  }
  function parseFoto(j: any) {
    const h = j.html || j.textAsHtml || "";
    const m = h.match(/https:\/\/cdn\.blablacar\.com\/user-profile-picture\/[A-Za-z0-9]+\/thumbnail_144x144\.jpe?g/i);
    return m ? m[0] : "";
  }
  const msgs = msgsIn.slice().sort((a, b) => new Date(a.date || a.internalDate || 0).getTime() - new Date(b.date || b.internalDate || 0).getTime());
  const registros: any[] = [];
  const chave = (r: any) => norm(r.nome) + "|" + r.dia + "|" + norm(r.embarque) + "|" + norm(r.destino);
  const RE_RESERVA = /acabou de reservar um lugar/i;
  const RE_CANCEL = /precisou cancelar|\bcancelou\b/i;
  for (const j of msgs) {
    const t = corpo(j);
    const assunto = norm(j.subject || "");
    const reserva = RE_RESERVA.test(t) || assunto.includes("novo passageiro");
    const cancel = !reserva && (RE_CANCEL.test(t) || assunto.includes("cancelamento"));
    if (!reserva && !cancel) continue;
    const mNome = t.match(/(?:BlaBlaCar\s+)?([^\n]+?)\s+(?:acabou de reservar|precisou cancelar|cancelou)\b/i);
    const nome = (mNome ? mNome[1] : "").replace(/^BlaBlaCar\s+/i, "").trim().replace(/\s+/g, " ");
    const { dia, iso } = parseData(t);
    const { embarque, destino } = parseRota(t);
    if (!nome || !dia || !embarque || !destino) continue;
    const dir = idxCidade(embarque) <= idxCidade(destino) ? "F" : "B";
    const reg: any = { nome, dia, iso, embarque, destino, grupo: dia + "|" + dir };
    for (let i = registros.length - 1; i >= 0; i--) if (chave(registros[i]) === chave(reg)) registros.splice(i, 1);
    if (reserva) {
      const v = t.match(/R\$\s*([\d.,]+)/);
      reg.valor = v ? Number(v[1].replace(/\./g, "").replace(",", ".")) : null;
      reg.foto = parseFoto(j);
      registros.push(reg);
    }
  }
  const grupos: Record<string, any[]> = {};
  for (const r of registros) (grupos[r.grupo] = grupos[r.grupo] || []).push(r);
  const inicioDe = (g: string) => grupos[g].map((r) => r.iso).sort()[0];
  const fimDe = (g: string) => grupos[g].map((r) => r.iso).sort().pop();
  const ms = (iso: string) => new Date(iso + "-03:00").getTime();
  const BUFFER = 3 * 3600 * 1000;
  const agora = Date.now();
  const ordenados = Object.keys(grupos).filter((g) => inicioDe(g)).sort((a, b) => inicioDe(a).localeCompare(inicioDe(b)));
  const escolhida =
    ordenados.find((g) => agora >= ms(inicioDe(g)) && agora <= ms(fimDe(g)!) + BUFFER) ||
    ordenados.find((g) => ms(inicioDe(g)) > agora) ||
    ordenados[ordenados.length - 1];
  const pax = escolhida ? grupos[escolhida] : [];
  const forward = pax.length ? idxCidade(pax[0].embarque) <= idxCidade(pax[0].destino) : true;
  const cidades = [...new Set(pax.flatMap((r) => [r.embarque, r.destino]))].sort((a, b) => forward ? idxCidade(a) - idxCidade(b) : idxCidade(b) - idxCidade(a));
  const hhmm = (iso: string) => (iso && iso.indexOf("T") >= 0) ? iso.slice(iso.indexOf("T") + 1, iso.indexOf("T") + 6) : "";
  const horaCidade: Record<string, string> = {};
  pax.forEach((r) => { if (r.embarque && r.iso && (!horaCidade[r.embarque] || r.iso < horaCidade[r.embarque])) horaCidade[r.embarque] = r.iso; });
  return {
    origem: cidades[0] || "",
    destino: cidades[cidades.length - 1] || "",
    dataHora: escolhida ? inicioDe(escolhida) : "",
    paradas: cidades.map((nome) => ({ nome, foto: "", horario: hhmm(horaCidade[nome]) })),
    passageiros: pax.map((r, i) => ({ id: "p" + (i + 1), nome: r.nome, foto: r.foto || "", embarque: r.embarque, destino: r.destino, horario: hhmm(r.iso), valor: r.valor, telefone: "", status: "pendente", pagoEm: null })),
  };
}

function tokenFromTo(to: any): string {
  const s = Array.isArray(to) ? to.join(",") : String(to || "");
  const m = s.match(/\+([a-z0-9]+)@/i);
  return m ? m[1].toLowerCase() : "";
}
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true, hint: "POST an email payload here" }, 200);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  if (INGEST_SECRET) {
    const got = req.headers.get("x-ingest-secret") || payload.secret || "";
    if (got !== INGEST_SECRET) return json({ error: "unauthorized" }, 401);
  }

  const token = (payload.token || tokenFromTo(payload.to)).toLowerCase();
  const from = String(payload.from || "");
  const subject = String(payload.subject || "");
  const text = String(payload.text || payload.body_text || "");
  const html = String(payload.html || payload.body_html || "");
  if (!token) return json({ error: "no token in recipient" }, 200);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "blablapague" } });

  const { data: driver, error: dErr } = await supa.from("drivers").select("id, config").eq("ingest_token", token).maybeSingle();
  if (dErr) return json({ error: dErr.message }, 500);
  if (!driver) return json({ ignored: "unknown token" }, 200);

  // Segurança: só aceita e-mail da BlaBlaCar (evita injeção de viagens falsas).
  if (!/blablacar/i.test(from) && !/blablacar/i.test(subject) && !/blablacar/i.test(text) && !/blablacar/i.test(html)) {
    return json({ ignored: "not a blablacar email" }, 200);
  }

  await supa.from("emails").insert({ driver_id: driver.id, mail_from: from, subject, body_text: text, body_html: html });

  const { data: emails } = await supa.from("emails")
    .select("received_at, subject, body_text, body_html")
    .eq("driver_id", driver.id).order("received_at", { ascending: true }).limit(500);
  const msgs = (emails || []).map((e: any) => ({ date: e.received_at, subject: e.subject, text: e.body_text, html: e.body_html }));

  const rota: string[] = (driver.config && Array.isArray(driver.config.rota)) ? driver.config.rota : [];
  if (!rota.length) return json({ stored: true, trip: null, note: "driver has no rota configured" }, 200);

  const trip = remontarViagem(msgs, rota);
  await supa.from("drivers").update({ current_trip: trip, trip_updated_at: new Date().toISOString() }).eq("id", driver.id);

  return json({ ok: true, passageiros: trip.passageiros.length, origem: trip.origem, destino: trip.destino, dataHora: trip.dataHora }, 200);
});

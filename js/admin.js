/*
 * admin.js — Tela de configuração (motorista). Salva tudo no localStorage.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const cores = ['#2a6df4', '#17b978', '#f2637a', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444', '#10b981'];
  const corDoNome = (n) => { let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return cores[Math.abs(h) % cores.length]; };
  const iniciais = (n) => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '')[0] || '?').toUpperCase() + (p[1] ? p[1][0].toUpperCase() : ''); };

  let trip = Store.getTrip();
  let cfg = Store.getConfig();

  // Reduz a imagem para no máx. `max` px antes de salvar (economiza espaço no localStorage)
  function resize(file, max) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = r.result;
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // -------- Config --------
  function carregarConfig() {
    $('#pixKey').value = cfg.pixKey || '';
    $('#merchantName').value = cfg.merchantName || '';
    $('#merchantCity').value = cfg.merchantCity || '';
    $('#valorPadrao').value = cfg.valorPadrao != null ? cfg.valorPadrao : '';
    $('#carroModelo').value = cfg.carroModelo || '';
    $('#carroCor').value = cfg.carroCor || '';
    $('#carroPlaca').value = cfg.carroPlaca || '';
    $('#n8nWebhookUrl').value = cfg.n8nWebhookUrl || '';
    $('#viagemFeedUrl').value = cfg.viagemFeedUrl || '';
    $('#origem').value = trip.origem || '';
    $('#destino').value = trip.destino || '';
    $('#dataHora').value = trip.dataHora || '';
  }

  // -------- Passageiros --------
  function renderPassageiros() {
    const box = $('#passageiros');
    box.innerHTML = '';
    (trip.passageiros || []).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'pcard';
      row.innerHTML = `
        <div class="pc-top">
          <label class="mini" style="${p.foto ? '' : 'background:' + corDoNome(p.nome || '?')}">
            ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : iniciais(p.nome || '?')}
            <input type="file" accept="image/*" data-foto="${i}">
          </label>
          <input class="nome" data-nome="${i}" placeholder="Nome" value="${(p.nome || '').replace(/"/g, '&quot;')}">
          <input class="valor" data-valor="${i}" type="number" step="0.01" placeholder="Valor" value="${p.valor != null ? p.valor : ''}">
          <button class="rm" data-rm="${i}" title="Remover">✕</button>
        </div>
        <div class="pc-bot">
          <input data-embarque="${i}" placeholder="Embarque" value="${(p.embarque || '').replace(/"/g, '&quot;')}">
          <input data-destino="${i}" placeholder="Destino" value="${(p.destino || '').replace(/"/g, '&quot;')}">
          <input data-telefone="${i}" placeholder="Telefone (WhatsApp)" value="${(p.telefone || '').replace(/"/g, '&quot;')}">
        </div>`;
      box.appendChild(row);
    });
    box.querySelectorAll('[data-nome]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.nome].nome = e.target.value; }));
    box.querySelectorAll('[data-embarque]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.embarque].embarque = e.target.value; }));
    box.querySelectorAll('[data-destino]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.destino].destino = e.target.value; }));
    box.querySelectorAll('[data-telefone]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.telefone].telefone = e.target.value; }));
    box.querySelectorAll('[data-valor]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.valor].valor = e.target.value === '' ? null : Number(e.target.value); }));
    box.querySelectorAll('[data-rm]').forEach((el) => el.addEventListener('click', (e) => { trip.passageiros.splice(Number(e.target.dataset.rm), 1); renderPassageiros(); }));
    box.querySelectorAll('[data-foto]').forEach((el) => el.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      trip.passageiros[e.target.dataset.foto].foto = await resize(f, 256);
      renderPassageiros();
    }));
  }

  // -------- Paradas --------
  function renderParadas() {
    const box = $('#paradas');
    box.innerHTML = '';
    (trip.paradas || []).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <label class="mini paradaimg" style="background:#334">
          ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : '📍'}
          <input type="file" accept="image/*" data-pfoto="${i}">
        </label>
        <input data-pnome="${i}" placeholder="Nome da parada" value="${(p.nome || '').replace(/"/g, '&quot;')}">
        <button class="rm" data-prm="${i}" title="Remover">✕</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll('[data-pnome]').forEach((el) => el.addEventListener('input', (e) => { trip.paradas[e.target.dataset.pnome].nome = e.target.value; }));
    box.querySelectorAll('[data-prm]').forEach((el) => el.addEventListener('click', (e) => { trip.paradas.splice(Number(e.target.dataset.prm), 1); renderParadas(); }));
    box.querySelectorAll('[data-pfoto]').forEach((el) => el.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      trip.paradas[e.target.dataset.pfoto].foto = await resize(f, 400);
      renderParadas();
    }));
  }

  // -------- Salvar / ações --------
  function coletarConfig() {
    cfg = {
      pixKey: $('#pixKey').value.trim(),
      merchantName: $('#merchantName').value.trim() || 'MOTORISTA',
      merchantCity: $('#merchantCity').value.trim() || 'CIDADE',
      valorPadrao: $('#valorPadrao').value === '' ? 0 : Number($('#valorPadrao').value),
      carroModelo: $('#carroModelo').value.trim(),
      carroCor: $('#carroCor').value.trim(),
      carroPlaca: $('#carroPlaca').value.trim(),
      n8nWebhookUrl: $('#n8nWebhookUrl').value.trim(),
      viagemFeedUrl: $('#viagemFeedUrl').value.trim()
    };
    trip.origem = $('#origem').value.trim();
    trip.destino = $('#destino').value.trim();
    trip.dataHora = $('#dataHora').value;
  }

  function salvar() {
    coletarConfig();
    try {
      Store.setConfig(cfg);
      Store.setTrip(trip);
    } catch (e) {
      toast('❌ Não consegui salvar (aba anônima ou memória cheia?): ' + e.message);
      return;
    }
    // Confirma que persistiu de verdade (revela armazenamento bloqueado no celular)
    if (Store.getConfig().viagemFeedUrl !== cfg.viagemFeedUrl) {
      toast('⚠️ Não persistiu! Não use aba anônima e abra o app por um endereço (http), não como arquivo.');
      return;
    }
    toast('Salvo! ✅ Endpoint gravado.');
  }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  $('#addPass').addEventListener('click', () => { (trip.passageiros = trip.passageiros || []).push({ id: Store.newId(), nome: '', foto: '', valor: null, embarque: '', destino: '', telefone: '', status: 'pendente', pagoEm: null }); renderPassageiros(); });
  $('#addParada').addEventListener('click', () => { (trip.paradas = trip.paradas || []).push({ nome: '', foto: '' }); renderParadas(); });
  $('#salvar').addEventListener('click', salvar);
  $('#zerar').addEventListener('click', () => { trip = Store.resetPayments(); renderPassageiros(); toast('Pagamentos zerados.'); });
  $('#exemplo').addEventListener('click', () => { if (confirm('Substituir tudo pela viagem de exemplo?')) { trip = Store.loadSample(); renderPassageiros(); renderParadas(); carregarConfig(); toast('Exemplo carregado.'); } });

  $('#exportar').addEventListener('click', () => {
    coletarConfig();
    const blob = new Blob([JSON.stringify({ config: cfg, trip }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blablapague-viagem.json'; a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#importarBtn').addEventListener('click', () => $('#importar').click());
  $('#importar').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.trip) { trip = d.trip; Store.setTrip(trip); }
        if (d.config) { cfg = d.config; Store.setConfig(cfg); }
        carregarConfig(); renderPassageiros(); renderParadas(); toast('Importado! ✅');
      } catch (err) { toast('Arquivo inválido.'); }
    };
    r.readAsText(f);
  });

  // -------- Confirmar viagem (WhatsApp via n8n + Evolution API) --------
  const soDigitos = (t) => String(t || '').replace(/\D/g, '');
  const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  function fmtData(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function carroTexto() {
    const base = [cfg.carroModelo, cfg.carroCor].filter(Boolean).join(' ');
    return (base || '(carro não informado)') + (cfg.carroPlaca ? ` — placa ${cfg.carroPlaca}` : '');
  }
  // Monta a mensagem de WhatsApp personalizada de um passageiro
  function montarMensagem(p) {
    const primeiro = (p.nome || '').trim().split(/\s+/)[0] || 'passageiro(a)';
    const paradas = (trip.paradas || []).map((x) => x.nome).filter(Boolean).join(' → ');
    const valor = brl(p.valor != null ? p.valor : cfg.valorPadrao);
    const trecho = [p.embarque ? `embarque em *${p.embarque}*` : '', p.destino ? `desembarque em *${p.destino}*` : ''].filter(Boolean).join(' e ');
    return [
      `Olá, ${primeiro}! 🚗✨`, ``,
      `Sua viagem está *CONFIRMADA*!`, ``,
      `🗺️ *Trajeto:* ${trip.origem || ''} → ${trip.destino || ''}`,
      paradas ? `🛑 Paradas: ${paradas}` : '',
      trip.dataHora ? `🕒 Saída: ${fmtData(trip.dataHora)}` : '', ``,
      trecho ? `📍 *Seu trecho:* ${trecho}` : '',
      `💰 *Valor:* ${valor} (pagamento via PIX)`, ``,
      `🚙 *Carro:* ${carroTexto()}`,
      `🛰️ *Acompanhe a localização em tempo real pelo app da BlaBlaCar.*`, ``,
      `Nos vemos logo! Qualquer dúvida, é só responder aqui. 🙌`
    ].join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function montarPayload(passageiros) {
    return {
      acao: 'confirmar_viagem',
      viagem: {
        origem: trip.origem || '', destino: trip.destino || '', dataHora: trip.dataHora || '',
        paradas: (trip.paradas || []).map((x) => x.nome).filter(Boolean),
        carro: { modelo: cfg.carroModelo, cor: cfg.carroCor, placa: cfg.carroPlaca }
      },
      passageiros: passageiros.map((p) => ({
        nome: p.nome, telefone: soDigitos(p.telefone), telefoneOriginal: p.telefone || '',
        embarque: p.embarque || '', destino: p.destino || '',
        valor: p.valor != null ? p.valor : cfg.valorPadrao,
        mensagem: montarMensagem(p)
      }))
    };
  }
  function abrirConfirmacao() {
    coletarConfig();
    if (!cfg.n8nWebhookUrl) { toast('Configure a URL do webhook do n8n primeiro.'); return; }
    const comTel = (trip.passageiros || []).filter((p) => soDigitos(p.telefone).length >= 10);
    const semTel = (trip.passageiros || []).filter((p) => soDigitos(p.telefone).length < 10);
    if (!comTel.length) { toast('Nenhum passageiro com telefone válido.'); return; }
    $('#confCorpo').innerHTML =
      `Vou enviar a confirmação por WhatsApp para <b>${comTel.length}</b> passageiro(s), via n8n → Evolution API.` +
      (semTel.length ? `<br><span style="color:#8a5300">⚠️ ${semTel.length} sem telefone (não recebem): ${semTel.map((p) => p.nome).join(', ')}</span>` : '');
    $('#confPreview').textContent = montarMensagem(comTel[0]);
    $('#confBg').classList.add('aberto');
  }
  function fecharConfirmacao() { $('#confBg').classList.remove('aberto'); }
  async function enviarConfirmacao() {
    const btn = $('#confEnviar'); btn.disabled = true; btn.textContent = 'Enviando...';
    const comTel = (trip.passageiros || []).filter((p) => soDigitos(p.telefone).length >= 10);
    const payload = montarPayload(comTel);
    try {
      const resp = await fetch(cfg.n8nWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) { toast(`✅ Enviado ao n8n (${comTel.length} passageiro(s)).`); fecharConfirmacao(); }
      else { toast(`n8n respondeu ${resp.status}. Verifique o fluxo.`); }
    } catch (e) {
      // CORS/rede: o POST provavelmente chegou, mas não deu pra ler a resposta
      toast('Enviado, mas sem confirmação (CORS/rede). Cheque no n8n.');
      fecharConfirmacao();
    } finally { btn.disabled = false; btn.textContent = 'Enviar agora'; }
  }
  $('#confirmarViagem').addEventListener('click', abrirConfirmacao);
  $('#confCancelar').addEventListener('click', fecharConfirmacao);
  $('#confEnviar').addEventListener('click', enviarConfirmacao);
  $('#confBg').addEventListener('click', (e) => { if (e.target.id === 'confBg') fecharConfirmacao(); });

  // Início
  carregarConfig();
  renderPassageiros();
  renderParadas();
})();

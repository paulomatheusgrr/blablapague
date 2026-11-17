/*
 * admin.js — Tela de configuração (motorista). Salva tudo no localStorage.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  let trip = Store.getTrip();
  let cfg = Store.getConfig();
  let logado = false;

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
  }

  // -------- Salvar / ações --------
  // Mescla os campos do formulário SOBRE a cfg atual (preserva flags que não
  // aparecem aqui: zoom, propaganda, voz, volume, jogo, etc.).
  function coletarConfig() {
    cfg = Object.assign({}, cfg, {
      pixKey: $('#pixKey').value.trim(),
      merchantName: $('#merchantName').value.trim() || 'MOTORISTA',
      merchantCity: $('#merchantCity').value.trim() || 'CIDADE',
      valorPadrao: $('#valorPadrao').value === '' ? 0 : Number($('#valorPadrao').value),
      carroModelo: $('#carroModelo').value.trim(),
      carroCor: $('#carroCor').value.trim(),
      carroPlaca: $('#carroPlaca').value.trim(),
      n8nWebhookUrl: $('#n8nWebhookUrl').value.trim(),
      viagemFeedUrl: $('#viagemFeedUrl').value.trim()
    });
  }

  async function salvar() {
    coletarConfig();
    // 1) Cache local (offline) — sempre.
    try {
      Store.setConfig(cfg);
    } catch (e) {
      toast('❌ Não consegui salvar (aba anônima ou memória cheia?): ' + e.message);
      return;
    }
    if (Store.getConfig().viagemFeedUrl !== cfg.viagemFeedUrl) {
      toast('⚠️ Não persistiu! Não use aba anônima e abra o app por um endereço (http), não como arquivo.');
      return;
    }
    // 2) Nuvem (conta do motorista), se logado.
    if (window.BlaBlaSupa && BlaBlaSupa.ready() && logado) {
      const btn = $('#salvar'); const txt = btn.textContent;
      btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        await BlaBlaSupa.saveConfig(cfg);
        toast('Salvo na sua conta ✅ (vale em todos os aparelhos).');
      } catch (e) {
        toast('Salvo neste aparelho, mas falhou na nuvem: ' + (e && e.message ? e.message : e));
      } finally { btn.disabled = false; btn.textContent = txt; }
    } else {
      toast('Salvo neste aparelho ✅');
    }
  }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  $('#salvar').addEventListener('click', salvar);
  $('#zerar').addEventListener('click', () => { Store.resetPayments(); toast('Pagamentos zerados no aparelho.'); });

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

  // -------- Início: exige login quando o Supabase está disponível --------
  async function init() {
    const temSupa = !!(window.BlaBlaSupa && BlaBlaSupa.ready());
    if (temSupa) {
      let sess = null;
      try { sess = await BlaBlaSupa.getSession(); } catch (e) {}
      if (!sess) {
        // Sem login → manda pra tela de entrar (a não ser que esteja offline).
        if (navigator.onLine !== false) { location.href = 'login.html'; return; }
      } else {
        logado = true;
        const u = sess.user || {};
        $('#contaEmail').textContent = u.email || '';
        $('#contaBar').style.display = 'flex';
        $('#btnSair').addEventListener('click', async () => {
          await BlaBlaSupa.signOut();
          location.href = 'login.html';
        });
        // Carrega a config da conta e usa como fonte da verdade (cacheia local).
        try {
          const nuvem = await BlaBlaSupa.loadConfig();
          if (nuvem) { cfg = Object.assign({}, cfg, nuvem); Store.setConfig(cfg); }
        } catch (e) { /* offline: segue com o cache local */ }
      }
    }
    carregarConfig();
  }
  init();
})();

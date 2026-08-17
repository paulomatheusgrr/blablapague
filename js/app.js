/*
 * app.js — Lógica do kiosk (Modelo A: PIX estático + confirmação manual).
 * Pontos de extensão para o Modelo B (confirmação automática) estão marcados
 * com  // [MODELO B].
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const cores = ['#2a6df4', '#17b978', '#f2637a', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444', '#10b981'];

  function corDoNome(nome) {
    let h = 0;
    for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
    return cores[Math.abs(h) % cores.length];
  }
  function iniciais(nome) {
    const p = String(nome || '?').trim().split(/\s+/);
    return ((p[0] || '')[0] || '?').toUpperCase() + (p[1] ? p[1][0].toUpperCase() : '');
  }
  // Cria um avatar: imagem (se houver foto) ou círculo com iniciais
  function avatarHTML(nome, foto) {
    if (foto) return `<img class="avatar" src="${foto}" alt="${nome}">`;
    return `<div class="avatar" style="background:${corDoNome(nome)}">${iniciais(nome)}</div>`;
  }
  const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  function quando(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // -------- QR Code (usa a lib local qrcode-generator) --------
  function gerarQR(container, texto) {
    container.innerHTML = '';
    if (typeof qrcode === 'undefined') {
      container.innerHTML = '<p style="color:#b91c1c;font-weight:700">Biblioteca de QR não carregada (js/qrcode.js).</p>';
      return;
    }
    try {
      const qr = qrcode(0, 'M');           // versão automática, correção média
      qr.addData(texto, 'Byte');
      qr.make();
      container.innerHTML = qr.createImgTag(6, 8); // cellSize, margem
      const img = container.querySelector('img');
      if (img) { img.style.width = 'min(300px,70vw)'; img.style.height = 'auto'; img.style.borderRadius = '14px'; }
    } catch (e) {
      container.innerHTML = '<p style="color:#b91c1c">Erro ao gerar QR: ' + e.message + '</p>';
    }
  }

  // -------- Estado --------
  let trip = Store.getTrip();
  let cfg = Store.getConfig();
  let atual = null; // passageiro aberto no modal

  // -------- Render --------
  function renderBanner() {
    $('#rotaBanner').innerHTML =
      `<span class="cidade">${trip.origem || ''}</span>` +
      `<span class="seta">➜</span>` +
      `<span class="cidade">${trip.destino || ''}</span>` +
      (trip.dataHora ? `<span class="quando">🕑 ${quando(trip.dataHora)}</span>` : '') +
      `<span class="valor">${brl(cfg.valorPadrao)}</span>`;
  }

  function renderPassageiros() {
    const grade = $('#grade');
    const lista = trip.passageiros || [];
    if (!lista.length) {
      grade.innerHTML = '<p style="color:#fff;grid-column:1/-1;text-align:center;opacity:.8">Nenhum passageiro cadastrado. Toque em ⚙️ para adicionar.</p>';
      return;
    }
    grade.innerHTML = lista.map((p) => `
      <div class="passageiro ${p.status === 'pago' ? 'pago' : ''}" data-id="${p.id}">
        ${avatarHTML(p.nome, p.foto)}
        <div class="nome">${p.nome}</div>
        <div class="preco">${brl(p.valor != null ? p.valor : cfg.valorPadrao)}</div>
      </div>`).join('');
    grade.querySelectorAll('.passageiro').forEach((el) => {
      el.addEventListener('click', () => {
        const p = lista.find((x) => x.id === el.dataset.id);
        if (p && p.status !== 'pago') abrirPagamento(p);
      });
    });
  }

  function renderRota() {
    const sec = $('#rotaSec');
    const paradas = trip.paradas || [];
    if (!paradas.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $('#paradas').innerHTML = paradas.map((p) => `
      <div class="parada">
        <span class="ponto"></span>
        ${p.foto ? `<img class="foto" src="${p.foto}" alt="">` : `<div class="foto">📍</div>`}
        <div class="rotulo">${p.nome || ''}</div>
      </div>`).join('');
  }

  // -------- Modal de pagamento --------
  function abrirPagamento(p) {
    atual = p;
    const valor = p.valor != null ? p.valor : cfg.valorPadrao;
    $('#mAvatar').outerHTML = avatarHTML(p.nome, p.foto).replace('class="avatar"', 'class="avatar" id="mAvatar"');
    $('#mNome').textContent = p.nome;
    $('#mValor').textContent = brl(valor);

    const temChave = !!(cfg.pixKey && cfg.pixKey.trim());
    $('#avisoPix').hidden = temChave;
    $('#mConteudo').style.display = temChave ? '' : 'none';

    if (temChave) {
      const payload = Pix.buildPix({
        key: cfg.pixKey,
        amount: valor,
        name: cfg.merchantName,
        city: cfg.merchantCity,
        txid: p.id
      });
      $('#mCopia').value = payload;
      gerarQR($('#qr'), payload);
      // [MODELO B] Aqui, em vez do PIX estático, criaríamos uma cobrança no
      // provedor (Efí/Mercado Pago/Asaas) e começaríamos a consultar o status
      // para marcar "pago" automaticamente, sem depender do botão abaixo.
    }
    $('#modalBg').classList.add('aberto');
  }

  function fecharModal() {
    $('#modalBg').classList.remove('aberto');
    atual = null;
  }

  function confirmarPagamento() {
    if (!atual) return;
    trip = Store.setPassengerStatus(atual.id, 'pago');
    fecharModal();
    renderPassageiros();
    festa();
    toast('Pagamento confirmado! Obrigado 🙌');
  }

  // -------- Copiar --------
  function copiar() {
    const inp = $('#mCopia');
    inp.select();
    inp.setSelectionRange(0, 99999);
    const done = () => { const b = $('#btnCopiar'); b.textContent = 'Copiado!'; setTimeout(() => (b.textContent = 'Copiar'), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(inp.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  }

  // -------- Toast + confete --------
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }

  function festa() {
    const selo = $('#pagoSelo');
    selo.classList.add('on');
    const cv = $('#confete');
    cv.classList.add('on');
    const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const N = 160;
    const ps = Array.from({ length: N }, () => ({
      x: innerWidth / 2, y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 1) * 16 - 2,
      s: 6 + Math.random() * 8, c: cores[(Math.random() * cores.length) | 0],
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 0
    }));
    let raf;
    const dur = 1600, t0 = performance.now();
    (function loop(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.vy += 0.5; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (t < dur) raf = requestAnimationFrame(loop);
      else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
    })(t0);
    setTimeout(() => selo.classList.remove('on'), 1200);
  }

  // -------- Eventos --------
  $('#btnVoltar').addEventListener('click', fecharModal);
  $('#btnPaguei').addEventListener('click', confirmarPagamento);
  $('#btnCopiar').addEventListener('click', copiar);
  $('#modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') fecharModal(); });
  // Recarrega se a config/viagem mudar em outra aba (ex.: admin)
  window.addEventListener('storage', () => { trip = Store.getTrip(); cfg = Store.getConfig(); renderBanner(); renderPassageiros(); renderRota(); });

  // -------- Início --------
  renderBanner();
  renderPassageiros();
  renderRota();
})();

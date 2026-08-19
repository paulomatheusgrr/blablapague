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
  // Versão pequena (para o balão sobre a parada de destino)
  function avatarMini(nome, foto) {
    if (foto) return `<img class="mini-avatar" src="${foto}" alt="${nome}">`;
    return `<div class="mini-avatar" style="background:${corDoNome(nome)}">${iniciais(nome)}</div>`;
  }
  // Normaliza nome de cidade para comparar (sem acento, minúsculo)
  function normaliza(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  // Compara destino do passageiro com o nome da parada (igual ou um contém o outro)
  function mesmaCidade(a, b) {
    const x = normaliza(a), y = normaliza(b);
    return !!x && !!y && (x === y || x.indexOf(y) > -1 || y.indexOf(x) > -1);
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
    grade.innerHTML = lista.map((p) => {
      const trecho = [p.embarque ? `📍 ${p.embarque}` : '', p.destino ? `🏁 ${p.destino}` : ''].filter(Boolean).join(' → ');
      return `
      <div class="passageiro ${p.status === 'pago' ? 'pago' : ''}" data-id="${p.id}">
        ${avatarHTML(p.nome, p.foto)}
        <div class="nome">${p.nome}</div>
        <div class="preco">${brl(p.valor != null ? p.valor : cfg.valorPadrao)}</div>
        ${trecho ? `<div class="destino-card">${trecho}</div>` : ''}
      </div>`;
    }).join('');
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
    const lista = trip.passageiros || [];
    $('#paradas').innerHTML = paradas.map((p) => {
      const descem = lista.filter((x) => mesmaCidade(x.destino, p.nome));
      const baloes = descem.length
        ? `<div class="baloes">${descem.map((x) => `<div class="balao" title="${x.nome} desce em ${p.nome}">${avatarMini(x.nome, x.foto)}</div>`).join('')}</div>`
        : '';
      return `
      <div class="parada">
        ${baloes}
        <span class="ponto"></span>
        ${p.foto ? `<img class="foto" src="${p.foto}" alt="">` : `<div class="foto">📍</div>`}
        <div class="rotulo">${p.nome || ''}</div>
      </div>`;
    }).join('');
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
    const nome = atual.nome;
    trip = Store.setPassengerStatus(atual.id, 'pago');
    fecharModal();
    renderPassageiros();
    festa();
    mostrarAvaliacao(nome);
  }

  // -------- Agradecimento + pedido de 5 estrelas --------
  let avaliarShow, avaliarHide;
  function mostrarAvaliacao(nome) {
    clearTimeout(avaliarShow);
    clearTimeout(avaliarHide);
    const primeiro = nome ? String(nome).trim().split(/\s+/)[0] : '';
    $('#avaliarTitulo').textContent = primeiro ? `Obrigado, ${primeiro}! 🙌` : 'Obrigado! 🙌';
    const bg = $('#avaliarBg');
    // aparece logo depois do selo de "pago" + confete
    avaliarShow = setTimeout(() => bg.classList.add('aberto'), 900);
    avaliarHide = setTimeout(() => bg.classList.remove('aberto'), 13000);
  }
  function fecharAvaliacao() {
    clearTimeout(avaliarShow);
    clearTimeout(avaliarHide);
    $('#avaliarBg').classList.remove('aberto');
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
  $('#avaliarFechar').addEventListener('click', fecharAvaliacao);
  $('#avaliarBg').addEventListener('click', (e) => { if (e.target.id === 'avaliarBg') fecharAvaliacao(); });
  // Recarrega se a config/viagem mudar em outra aba (ex.: admin)
  window.addEventListener('storage', () => { trip = Store.getTrip(); cfg = Store.getConfig(); renderBanner(); renderPassageiros(); renderRota(); });

  // -------- Manter a tela acesa (Wake Lock) --------
  let wakeLock = null;
  async function manterTelaAcesa() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { /* pode falhar se a aba não estiver visível; tentamos de novo */ }
  }
  // Reobtém o lock quando a aba volta a ficar visível (o SO libera ao esconder)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLock) manterTelaAcesa();
  });
  // Alguns navegadores só concedem após um gesto do usuário
  document.addEventListener('click', () => { if (!wakeLock) manterTelaAcesa(); }, { once: false });

  // -------- Início --------
  renderBanner();
  renderPassageiros();
  renderRota();
  manterTelaAcesa();
})();

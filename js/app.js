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
      if (img) { img.style.width = 'min(520px, 88vw, 62vh)'; img.style.height = 'auto'; img.style.borderRadius = '14px'; }
    } catch (e) {
      container.innerHTML = '<p style="color:#b91c1c">Erro ao gerar QR: ' + e.message + '</p>';
    }
  }

  // -------- Estado --------
  // Define a viagem atual já SEM os "não embarcou" (filtro de no-shows).
  function usarTrip(t) { trip = Store.filtrarRemovidos(t); return trip; }
  let trip = Store.filtrarRemovidos(Store.getTrip());
  let cfg = Store.getConfig();
  let atual = null; // passageiro aberto no modal
  // Mostra "Carregando…" só num aparelho novo (feed configurado e nada salvo ainda).
  // Se já houver viagem salva de um sync anterior, mostra ela na hora.
  let feedPendente = !!cfg.viagemFeedUrl && !localStorage.getItem('blablacar_trip');

  // -------- Render --------
  function renderBanner() {
    if (feedPendente) { $('#rotaBanner').innerHTML = ''; return; }
    $('#rotaBanner').innerHTML =
      `<span class="cidade">${trip.origem || ''}</span>` +
      `<span class="seta">➜</span>` +
      `<span class="cidade">${trip.destino || ''}</span>` +
      (trip.dataHora ? `<span class="quando">🕑 ${quando(trip.dataHora)}</span>` : '');
  }

  function renderPassageiros() {
    const grade = $('#grade');
    if (feedPendente) {
      grade.innerHTML = '<p style="color:#fff;grid-column:1/-1;text-align:center;opacity:.85;font-size:1.25rem;padding:2.5rem">⏳ Carregando a viagem…</p>';
      return;
    }
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
    equilibrarCards();
  }

  // Distribui os cards em linhas equilibradas (ex.: 6 → 3+3, 5 → 3+2),
  // evitando "sobrar 1" na última linha. Em tela baixa (carro) mantém 1 linha.
  function equilibrarCards() {
    const grade = $('#grade');
    const cards = [...grade.querySelectorAll('.passageiro')];
    const n = cards.length;
    cards.forEach((c) => { c.style.flexBasis = ''; c.style.flexGrow = ''; });
    if (n < 2) return;
    const cs = getComputedStyle(grade);
    const gap = parseFloat(cs.columnGap) || 16;
    const contW = grade.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const baixa = window.innerHeight <= 520;      // tela do carro → uma linha só
    const minCard = baixa ? 120 : 210;            // largura mínima confortável do card
    const cabem = Math.max(1, Math.floor((contW + gap) / (minCard + gap)));
    let cols;
    if (baixa) {
      cols = Math.min(n, cabem);
    } else {
      const linhas = Math.ceil(n / cabem);        // nº de linhas necessárias
      cols = Math.ceil(n / linhas);               // colunas equilibradas
    }
    cols = Math.max(1, Math.min(cols, n));
    const basis = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;
    cards.forEach((c) => { c.style.flexBasis = basis; c.style.flexGrow = '0'; });
  }

  function renderRota() {
    const sec = $('#rotaSec');
    if (feedPendente) { sec.hidden = true; return; }
    const paradas = trip.paradas || [];
    if (!paradas.length) { sec.hidden = true; return; }
    sec.hidden = false;
    const lista = trip.passageiros || [];
    const comp = horariosCompletos();
    $('#paradas').innerHTML = paradas.map((p, i) => {
      const descem = lista.filter((x) => mesmaCidade(x.destino, p.nome));
      const baloes = descem.length
        ? `<div class="baloes">${descem.map((x) => `<div class="balao" title="${x.nome} desce em ${p.nome}">${avatarMini(x.nome, x.foto)}</div>`).join('')}</div>`
        : '';
      const h = comp[i] || {};
      const horaHtml = h.hora ? `<div class="hora-parada${h.est ? ' est' : ''}">🕐 ${h.est ? '~' : ''}${h.hora}</div>` : '';
      return `
      <div class="parada">
        ${baloes}
        <span class="ponto"></span>
        ${p.foto ? `<img class="foto" src="${p.foto}" alt="">` : `<div class="foto">📍</div>`}
        <div class="rotulo">${p.nome || ''}</div>
        ${horaHtml}
      </div>`;
    }).join('');
    atualizarCarro(); // o innerHTML acima removeu o carrinho — reposiciona
  }

  // -------- Carro ao vivo na rota (geolocalização) --------
  // Coordenadas (centro aprox.) das cidades da rota. Adicione outras se rodar novos trajetos.
  const CIDADES = {
    'botucatu': [-22.8858, -48.4450],
    'sao manuel': [-22.7314, -48.5709],
    'lencois paulista': [-22.5983, -48.8034],
    'agudos': [-22.4686, -48.9870],
    'bauru': [-22.3147, -49.0606]
  };
  const RAIO_CHEGADA = 4; // km: dentro disso, considera que "chegou" na cidade
  let posCarro = null;    // {lat, lng} do GPS

  function coordCidade(nome) { return CIDADES[normaliza(nome)] || null; }
  function distKm(a, b) {
    const R = 6371, toR = (x) => x * Math.PI / 180;
    const dLat = toR(b[0] - a[0]), dLon = toR(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function iniciarGeo() {
    if (cfg.rastrearCarro === false || !navigator.geolocation) return;
    try {
      navigator.geolocation.watchPosition(
        (p) => { posCarro = { lat: p.coords.latitude, lng: p.coords.longitude }; atualizarCarro(); },
        () => {}, // negado/erro: sem carrinho, a rota funciona normal
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
      );
    } catch (e) {}
  }

  // Posiciona o carrinho na linha e pisca os passageiros da cidade atual
  function atualizarCarro() {
    if (!posCarro) return;
    requestAnimationFrame(() => {
    const box = $('#paradas');
    const sec = $('#rotaSec');
    if (!box || sec.hidden || !posCarro) return;
    const paradas = trip.paradas || [];
    const els = box.querySelectorAll('.parada');
    const pts = paradas.map((p, i) => ({ i, nome: p.nome, coord: coordCidade(p.nome), el: els[i] }));
    const comCoord = pts.filter((p) => p.coord && p.el);
    if (comCoord.length < 2) return;
    const car = [posCarro.lat, posCarro.lng];
    comCoord.forEach((p) => { p.dist = distKm(car, p.coord); });
    const perto = comCoord.reduce((a, b) => (b.dist < a.dist ? b : a));

    const cx = (el) => el.offsetLeft + el.offsetWidth / 2; // x central de uma parada
    let x = cx(perto.el);
    const vizinhos = [pts[perto.i - 1], pts[perto.i + 1]].filter((v) => v && v.coord && v.el);
    if (vizinhos.length) {
      const viz = vizinhos.reduce((a, b) => (distKm(car, b.coord) < distKm(car, a.coord) ? b : a));
      const dB = distKm(car, viz.coord);
      const frac = perto.dist / (perto.dist + dB); // 0 = na "perto", 1 = no vizinho
      x = cx(perto.el) + (cx(viz.el) - cx(perto.el)) * frac;
    }

    let carro = box.querySelector('#carroRota');
    // insertBefore(firstChild): mantém o carrinho como PRIMEIRO filho, pra que
    // a última parada continue sendo :last-child (senão sobra linha após o destino).
    if (!carro) { carro = document.createElement('div'); carro.id = 'carroRota'; carro.className = 'carro-rota'; carro.innerHTML = '<span class="carro-emoji">🚗</span>'; box.insertBefore(carro, box.firstChild); }
    const dot0 = box.querySelector('.parada .ponto');
    const yLinha = (dot0 ? dot0.parentElement.offsetTop + dot0.offsetTop + dot0.offsetHeight / 2 : 20);
    carro.style.top = yLinha + 'px';
    carro.style.left = x + 'px';

    // Barra de progresso (do 1º ponto até o carro) — tipo "carregando"
    let prog = box.querySelector('#progressoRota');
    if (!prog) { prog = document.createElement('div'); prog.id = 'progressoRota'; prog.className = 'rota-progresso'; box.insertBefore(prog, box.firstChild); }
    const x0 = cx(els[0]); // centro do 1º ponto (início da linha)
    prog.style.top = yLinha + 'px';
    prog.style.left = x0 + 'px';
    prog.style.width = Math.max(0, x - x0) + 'px';

    const cidadeAtual = perto.dist <= RAIO_CHEGADA ? perto.nome : null;
    box.querySelectorAll('.ponto').forEach((d, i) => d.classList.toggle('chegou', !!cidadeAtual && i === perto.i));
    marcarCidadeAtual(cidadeAtual);
    });
  }

  // Pisca (e rotula) os passageiros que embarcam/descem na cidade em que o carro está
  let cidadeAnunciada = null; // evita repetir o aviso a cada leitura do GPS
  function marcarCidadeAtual(cidade) {
    const lista = trip.passageiros || [];
    const embarcam = [], descem = [];
    document.querySelectorAll('#grade .passageiro').forEach((el) => {
      const p = lista.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const embarca = cidade && p.status !== 'pago' && mesmaCidade(p.embarque, cidade);
      const desce = cidade && mesmaCidade(p.destino, cidade);
      if (embarca) embarcam.push(p);
      if (desce && !embarca) descem.push(p);
      el.classList.toggle('piscando', !!(embarca || desce));
      el.classList.toggle('piscando-desce', !!desce && !embarca);
      let badge = el.querySelector('.acao-cidade');
      if (embarca || desce) {
        if (!badge) { badge = document.createElement('div'); badge.className = 'acao-cidade'; el.appendChild(badge); }
        // Seta num <span> separado pra animar só ela (sobe/desce).
        badge.innerHTML = embarca
          ? '<span class="seta">⬆</span> EMBARCA AQUI'
          : '<span class="seta">⬇</span> DESCE AQUI';
        badge.classList.toggle('desce', !!desce && !embarca);
      } else if (badge) { badge.remove(); }
    });

    // Anúncio (som + popup) quando CHEGA numa cidade nova com gente p/ embarcar/descer
    if (cidade && (embarcam.length || descem.length)) {
      if (cidade !== cidadeAnunciada) { cidadeAnunciada = cidade; anunciarCidade(cidade, embarcam, descem); }
    } else if (!cidade) {
      cidadeAnunciada = null; // saiu da cidade: libera pra anunciar de novo se voltar
    }
  }

  // -------- Anúncio de embarque/desembarque (som de aeroporto + popup) --------
  let audioCtx = null;
  let masterGain = null;
  let suspenderTimer = null;
  function desbloquearAudio() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    clearTimeout(suspenderTimer); // acordou: cancela qualquer "soltar foco" pendente
    // Aquece as vozes do TTS (carregam de forma assíncrona) no 1º gesto.
    try { if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); } catch (e) {}
  }
  // Solta o foco de áudio do Android (suspende o AudioContext) quando o anúncio
  // acaba, pra a MÚSICA DO CARRO VOLTAR. Reacorda sozinho no próximo som.
  function soltarFoco(ms) {
    clearTimeout(suspenderTimer);
    suspenderTimer = setTimeout(() => { try { if (audioCtx && audioCtx.state === 'running') audioCtx.suspend(); } catch (e) {} }, ms || 400);
  }
  // Saída amplificada: ganho (bem acima de 1) + limitador brickwall, pra o som
  // ficar alto e se destacar da música sem estourar. cfg.volumeBoost (padrão 5).
  function saidaAudio() {
    if (!audioCtx) return null;
    if (!masterGain) {
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -2; comp.knee.value = 0; comp.ratio.value = 20;
      comp.attack.value = 0.002; comp.release.value = 0.2;
      masterGain = audioCtx.createGain();
      masterGain.gain.value = (cfg.volumeBoost > 0) ? cfg.volumeBoost : 5;
      masterGain.connect(comp); comp.connect(audioCtx.destination);
    }
    return masterGain;
  }
  // Chime clássico de aeroporto (3 notas sino "bim-bam-bom") sintetizado, sem arquivo.
  function tocarChimeAeroporto() {
    if (cfg.somEmbarque === false) return;
    try {
      desbloquearAudio();
      if (!audioCtx) return;
      const t0 = audioCtx.currentTime;
      const notas = [ {f: 659.25, t: 0.00}, {f: 523.25, t: 0.45}, {f: 783.99, t: 0.90} ]; // E5, C5, G5
      for (const n of notas) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.f;
        const start = t0 + n.t;
        // envelope tipo sino: ataque rápido, cauda longa
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.95, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
        osc.connect(g); g.connect(saidaAudio() || audioCtx.destination);
        osc.start(start); osc.stop(start + 1.3);
      }
      // Se não vier voz logo em seguida, solta o foco ~2,6s após o chime.
      soltarFoco(2600);
    } catch (e) {}
  }
  // Junta os primeiros nomes de forma natural: "Ana", "Ana e Bruno", "Ana, Bruno e Carla"
  function nomesFalados(lista) {
    const n = lista.map((p) => (p.nome || '').trim().split(/\s+/)[0]).filter(Boolean);
    if (!n.length) return '';
    if (n.length === 1) return n[0];
    return n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
  }
  // Voz: no Android o Chrome só fala se o TTS tiver sido "destravado" por um
  // toque. Como o anúncio vem do GPS (sem toque), destravamos no 1º toque
  // falando algo mudo. Também guardamos referência da fala (o Android a
  // descarta pelo GC se nada apontar pra ela) e damos resume() (bug de pausa).
  let ttsDestravado = false;
  let __utterRef = null;
  function destravarVoz() {
    if (ttsDestravado || cfg.falarNomes === false) return;
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.getVoices();
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0; warm.lang = 'pt-BR';
      __utterRef = warm;
      window.speechSynthesis.speak(warm); // dentro do gesto → libera a sessão
      ttsDestravado = true;
    } catch (e) {}
  }
  // Elemento <audio> pra tocar a voz: ao tocar, o Android dá FOCO DE ÁUDIO e
  // abaixa/pausa a outra mídia (a música do carro) enquanto fala. Roteamos pelo
  // Web Audio pra manter o boost de volume.
  const SILENCIO = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  let vozAudioEl = null, vozSrcNode = null, elDestravado = false;
  function getVozEl() {
    if (!vozAudioEl) { vozAudioEl = new Audio(); vozAudioEl.crossOrigin = 'anonymous'; vozAudioEl.preload = 'auto'; }
    return vozAudioEl;
  }
  function destravarElemento() { // chamar DENTRO de um gesto (toque)
    if (elDestravado) return;
    try {
      const el = getVozEl();
      el.src = SILENCIO; el.muted = true;
      const p = el.play();
      if (p && p.then) p.then(() => { try { el.pause(); el.currentTime = 0; el.muted = false; } catch (e) {} }).catch(() => { el.muted = false; });
      elDestravado = true;
    } catch (e) {}
  }
  function falarPorElemento(url) {
    return new Promise((resolve, reject) => {
      try {
        const el = getVozEl();
        el.muted = false; el.volume = 1;
        if (audioCtx && !vozSrcNode) {
          vozSrcNode = true; // marca ANTES (createMediaElementSource só pode 1x por elemento)
          try { const n = audioCtx.createMediaElementSource(el); n.connect(saidaAudio() || audioCtx.destination); vozSrcNode = n; } catch (e) { /* sem roteamento: toca direto (sem boost, mas ainda abaixa a música) */ }
        }
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new (window.MediaMetadata || Object)({ title: 'Anúncio de embarque', artist: 'BlaBlaPague' });
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (e) {}
        el.onerror = () => { soltarFoco(300); reject(new Error('audio-el')); };
        el.onended = () => { try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; } catch (e) {} soltarFoco(300); };
        el.src = url;
        const p = el.play();
        if (p && p.then) p.then(() => resolve(true)).catch(reject); else resolve(true);
      } catch (e) { reject(e); }
    });
  }
  // Voz do navegador (reserva). No Android costuma exigir toque.
  function falarNavegador(texto) {
    try {
      if (!('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.rate = 0.98; u.pitch = 1; u.volume = 1;
      const vozes = synth.getVoices() || [];
      const vbr = vozes.find((v) => /pt[-_]?BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang));
      if (vbr) u.voice = vbr;
      __utterRef = u;                 // mantém referência (evita GC no Android)
      try { synth.resume(); } catch (e) {} // workaround do bug de pausa do Android
      synth.speak(u);
    } catch (e) {}
  }
  // Fala os nomes. Preferir o áudio do n8n (toca pelo AudioContext já
  // destravado → MÃOS LIVRES no Android, igual ao chime). Se falhar, usa a
  // voz do navegador como reserva.
  async function falar(texto) {
    if (cfg.falarNomes === false || !texto) return;
    if (cfg.ttsUrl) {
      desbloquearAudio();
      const sep = cfg.ttsUrl.indexOf('?') >= 0 ? '&' : '?';
      const url = cfg.ttsUrl + sep + 'text=' + encodeURIComponent(texto);
      // 1) Elemento <audio> → pede foco de áudio (abaixa a música do carro) + boost
      try { await falarPorElemento(url); return; } catch (e) { /* tenta o próximo */ }
      // 2) fetch + Web Audio (mãos livres + boost, mas NÃO abaixa a música)
      try {
        if (audioCtx) {
          const r = await fetch(url);
          if (r.ok) {
            const bytes = await r.arrayBuffer();
            const audio = await audioCtx.decodeAudioData(bytes);
            const src = audioCtx.createBufferSource();
            src.buffer = audio; src.connect(saidaAudio() || audioCtx.destination);
            src.onended = () => soltarFoco(300);
            src.start();
            return;
          }
        }
      } catch (e) { /* cai na voz do navegador abaixo */ }
    }
    falarNavegador(texto); // 3) reserva
  }
  // "17:40" -> "17 e 40" / "17:00" -> "17 horas" (pra a voz ler natural)
  function horaFalada(hhmm) {
    if (!hhmm || hhmm.indexOf(':') < 0) return '';
    const p = hhmm.split(':'); const H = parseInt(p[0], 10), M = parseInt(p[1], 10);
    if (isNaN(H)) return '';
    if (!M) return H + (H === 1 ? ' hora' : ' horas');
    return H + ' e ' + M;
  }
  function horaDaCidade(cidade) {
    const pr = (trip.paradas || []).find((p) => mesmaCidade(p.nome, cidade));
    return pr && pr.horario ? pr.horario : '';
  }
  // Horários de TODAS as paradas: usa o conhecido (embarque) e ESTIMA os que
  // faltam (ex.: destino final) pela distância + velocidade média dos trechos.
  const minsDe = (hhmm) => { const p = (hhmm || '').split(':'); const h = +p[0], m = +p[1]; return isNaN(h) || isNaN(m) ? null : h * 60 + m; };
  const hhmmDe = (min) => { min = Math.round(min); const h = ((Math.floor(min / 60)) % 24 + 24) % 24, m = (min % 60 + 60) % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
  function horariosCompletos() {
    const paradas = trip.paradas || [];
    let distSum = 0, timeSum = 0;
    for (let i = 0; i < paradas.length - 1; i++) {
      const ta = minsDe(paradas[i].horario), tb = minsDe(paradas[i + 1].horario);
      const ca = coordCidade(paradas[i].nome), cb = coordCidade(paradas[i + 1].nome);
      if (ta != null && tb != null && tb > ta && ca && cb) { distSum += distKm(ca, cb); timeSum += (tb - ta); }
    }
    const kmPorMin = (distSum > 0 && timeSum > 0) ? (distSum / timeSum) : (65 / 60); // 65 km/h padrão
    const out = []; let curMin = null, curCoord = null;
    for (const p of paradas) {
      const known = minsDe(p.horario), coord = coordCidade(p.nome);
      if (known != null) { curMin = known; out.push({ nome: p.nome, hora: p.horario, est: false }); }
      else if (curMin != null && coord && curCoord) { curMin += distKm(curCoord, coord) / kmPorMin; out.push({ nome: p.nome, hora: hhmmDe(curMin), est: true }); }
      else { out.push({ nome: p.nome, hora: '', est: false }); }
      if (coord) curCoord = coord;
    }
    return out;
  }
  let ultimaFala = ''; // guarda o texto do anúncio atual (p/ repetir no toque)
  function anunciarCidade(cidade, embarcam, descem) {
    tocarChimeAeroporto();
    const hora = horaDaCidade(cidade);
    const comp = horariosCompletos();
    const idx = comp.findIndex((p) => mesmaCidade(p.nome, cidade));
    const prox = (idx >= 0 && idx < comp.length - 1) ? comp[idx + 1] : null;
    const partes = [];
    partes.push(hora ? ('Chegada em ' + cidade + ', ' + horaFalada(hora)) : ('Chegando em ' + cidade));
    if (embarcam.length) partes.push('Embarque: ' + nomesFalados(embarcam));
    if (descem.length) {
      partes.push('Desembarque: ' + nomesFalados(descem));
      // Agradecimento caloroso a quem está descendo
      const plural = descem.length > 1;
      partes.push('Obrigado pela companhia, ' + nomesFalados(descem) + '! ' + (plural ? 'Tenham' : 'Tenha') + ' uma ótima viagem e até a próxima.');
    }
    if (prox) partes.push('Próxima parada: ' + prox.nome + (prox.hora ? (', ' + (prox.est ? 'previsão ' : '') + horaFalada(prox.hora)) : ''));
    ultimaFala = partes.join('. ');
    mostrarPopupAnuncio(cidade, hora, embarcam, descem, prox);
    // Tenta falar sozinho DEPOIS do chime (funciona no PC; em alguns Androids
    // só sai no toque — por isso o popup também fala quando tocado).
    if (ultimaFala) setTimeout(() => falar(ultimaFala), 1500);
  }
  // Resumo no início da viagem: paradas + chegada final (estimada).
  let resumoFalado = false, splashTocado = false;
  function falarResumoViagem() {
    if (resumoFalado || cfg.falarNomes === false) return;
    const comp = horariosCompletos();
    if (comp.length < 2) return;
    resumoFalado = true;
    const origem = comp[0].nome, final = comp[comp.length - 1];
    // Evita 2 vozes no começo: o resumo já cobre a origem, então não deixa o
    // anúncio automático da cidade de origem falar por cima.
    cidadeAnunciada = origem;
    const meio = comp.slice(0, -1).map((p) => p.nome + (p.hora ? (', ' + horaFalada(p.hora)) : '')).join('. ');
    let txt = 'Início da viagem de ' + origem + ' para ' + final.nome + '. Paradas: ' + meio + '.';
    if (final.hora) txt += ' Chegada ' + (final.est ? 'prevista ' : '') + 'em ' + final.nome + ', ' + horaFalada(final.hora) + '.';
    setTimeout(() => falar(txt), 700);
  }
  let anuncioTimer = null;
  function fecharAnuncio() { clearTimeout(anuncioTimer); $('#anuncioBg').classList.remove('aberto'); }
  function agendarFechar(ms) { clearTimeout(anuncioTimer); anuncioTimer = setTimeout(fecharAnuncio, ms); }
  function mostrarPopupAnuncio(cidade, hora, embarcam, descem, prox) {
    const bg = $('#anuncioBg'); if (!bg) return;
    const bloco = (titulo, klass, gente) => gente.length ? `
      <div class="anuncio-grupo ${klass}">
        <div class="anuncio-titulo">${titulo}</div>
        <div class="anuncio-gente">${gente.map((p) => `
          <div class="anuncio-pessoa">${avatarMini(p.nome, p.foto)}<span>${p.nome}</span></div>`).join('')}</div>
      </div>` : '';
    $('#anuncioCidade').textContent = cidade + (hora ? '  ·  🕐 ' + hora : '');
    $('#anuncioListas').innerHTML =
      bloco('🛫 Embarque', 'emb', embarcam) +
      bloco('🛬 Desembarque', 'des', descem);
    const elProx = $('#anuncioProx');
    if (elProx) {
      if (prox) { elProx.innerHTML = '➡️ Próxima: <b>' + prox.nome + '</b>' + (prox.hora ? ` · 🕐 ${prox.est ? '~' : ''}${prox.hora}` : ''); elProx.hidden = false; }
      else { elProx.hidden = true; }
    }
    bg.classList.add('aberto');
    agendarFechar(12000); // some sozinho depois de 12s
  }
  // Toque NO cartão = repete a fala (dispara no gesto → sai no Android).
  // Toque FORA do cartão (fundo escuro) = fecha.
  $('#anuncioBg').addEventListener('click', (e) => {
    if (e.target.closest('.anuncio-card')) {
      falar(ultimaFala);
      agendarFechar(12000); // mantém aberto mais um tempo
    } else {
      fecharAnuncio();
    }
  });
  // Libera áudio e voz nos primeiros toques (Android exige gesto; sem once
  // pra tentar de novo caso o 1º toque não destrave — cada função se protege).
  document.addEventListener('click', () => { desbloquearAudio(); destravarVoz(); destravarElemento(); });

  // Testar sem GPS: no console → simularCarro(-22.47, -48.99)
  window.simularCarro = (lat, lng) => { posCarro = { lat, lng }; atualizarCarro(); };

  // -------- Modal de pagamento --------
  function abrirPagamento(p) {
    atual = p;
    const valor = p.valor != null ? p.valor : cfg.valorPadrao;
    $('#mAvatar').outerHTML = avatarHTML(p.nome, p.foto).replace('class="avatar"', 'class="avatar" id="mAvatar"');
    $('#mNome').textContent = p.nome;
    $('#mValor').textContent = brl(valor);

    const temChave = !!(cfg.pixKey && cfg.pixKey.trim());
    $('#avisoPix').hidden = temChave;
    $('#qrBox').style.display = temChave ? '' : 'none';
    $('#mDetalhes').style.display = temChave ? '' : 'none';

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
    usarTrip(Store.setPassengerStatus(atual.id, 'pago'));
    fecharModal();
    renderPassageiros();
    festa();
    mostrarAvaliacao(nome);
  }

  // -------- Remover quem não embarcou (no-show) --------
  function removerNaoEmbarcou() {
    if (!atual) return;
    const p = atual;
    Store.addRemovido(trip.dataHora, p);     // persiste (não volta no próximo sync)
    usarTrip(Store.getTrip());               // reaplica o filtro
    fecharModal();
    renderBanner(); renderPassageiros(); renderRota();
    const primeiro = (p.nome || '').trim().split(/\s+/)[0] || 'Passageiro';
    toastDesfazer(`🚫 ${primeiro} removido (não embarcou).`, () => {
      Store.tirarRemovido(trip.dataHora, p);
      usarTrip(Store.getTrip());
      renderBanner(); renderPassageiros(); renderRota();
      toast(`${primeiro} de volta na viagem ✅`);
    });
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
  // Toast com ação "Desfazer" (fica mais tempo na tela).
  function toastDesfazer(msg, onUndo) {
    const t = $('#toast');
    t.innerHTML = '';
    t.appendChild(document.createTextNode(msg + ' '));
    const b = document.createElement('button');
    b.className = 'toast-undo'; b.textContent = 'Desfazer';
    b.onclick = () => { clearTimeout(toastT); t.classList.remove('show'); setTimeout(() => { t.textContent = ''; }, 300); try { onUndo && onUndo(); } catch (e) {} };
    t.appendChild(b);
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.textContent = ''; }, 300); }, 7000);
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
  $('#btnNaoEmbarcou').addEventListener('click', removerNaoEmbarcou);
  $('#btnCopiar').addEventListener('click', copiar);
  $('#modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') fecharModal(); });
  $('#avaliarFechar').addEventListener('click', fecharAvaliacao);
  $('#avaliarBg').addEventListener('click', (e) => { if (e.target.id === 'avaliarBg') fecharAvaliacao(); });
  // Recarrega se a config/viagem mudar em outra aba (ex.: admin)
  window.addEventListener('storage', () => { usarTrip(Store.getTrip()); cfg = Store.getConfig(); aplicarZoom(); renderBanner(); renderPassageiros(); renderRota(); });

  // Zoom da tela (ajuste fino p/ a multimídia do carro) — vem do config
  function aplicarZoom() { try { document.body.style.zoom = (cfg.zoom && cfg.zoom > 0) ? cfg.zoom : 1; } catch (e) {} }

  // Botão "Atualizar agora" — força uma sincronização (dispara o n8n na hora)
  $('#btnAtualizar').addEventListener('click', async (e) => {
    e.preventDefault();
    const b = $('#btnAtualizar');
    if (b.classList.contains('girando')) return; // já está atualizando
    b.classList.add('girando');
    toast('🔄 Buscando a viagem…');
    try { await sincronizar(); } catch (err) {}
    b.classList.remove('girando');
    toast('Viagem atualizada ✅');
  });

  // -------- Tela cheia (remove a barra do navegador da multimídia) --------
  function emFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  async function toggleFullscreen() {
    try {
      if (!emFullscreen()) {
        const el = document.documentElement;
        await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen && el.webkitRequestFullscreen());
      } else {
        await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen && document.webkitExitFullscreen());
      }
    } catch (e) { /* alguns navegadores bloqueiam sem gesto; o botão ⛶ resolve */ }
  }
  $('#btnFullscreen').addEventListener('click', (e) => { e.preventDefault(); toggleFullscreen(); });
  // Tenta entrar em tela cheia no 1º toque (precisa de gesto do usuário)
  document.addEventListener('click', () => { if (!emFullscreen()) toggleFullscreen(); }, { once: true });

  // -------- Botão "Jogar" (abre um app do Android, ex.: melonDS) --------
  function urlDoJogo() {
    if (cfg.jogoUrl) return cfg.jogoUrl; // override total (ex.: waze://..., outro app)
    const pkg = (cfg.jogoPackage || '').trim();
    if (!pkg) return '';
    // Intent do Chrome Android: abre a activity principal do app.
    // launchFlags = NEW_TASK(0x10000000) | LAUNCH_ADJACENT(0x1000): se o navegador
    // já estiver em tela dividida, abre no OUTRO lado; senão, abre em tela cheia.
    return 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + pkg + ';launchFlags=0x10001000;end';
  }
  (function () {
    const b = $('#btnJogar'); if (!b) return;
    const url = urlDoJogo();
    if (!url) { b.hidden = true; return; }
    b.hidden = false;
    b.addEventListener('click', (e) => { e.preventDefault(); try { window.location.href = url; } catch (err) {} });
  })();

  // -------- Carrossel de propaganda (popup animado, de tempos em tempos) --------
  // Anúncios fixos (o motorista pode editar o texto aqui). `precisaJogo: true`
  // só aparece se o botão "Jogar" estiver configurado (há app pra abrir).
  const PROPAGANDAS = [
    { emoji: '🎮', cor: '#8b5cf6', titulo: 'Tédio? Bora jogar!', texto: 'Pega o controle Bluetooth e joga no videogame da multimídia durante a viagem. 😎', precisaJogo: true },
    { emoji: '🔄', cor: '#2a6df4', titulo: 'Precisa voltar?', texto: 'Reserve sua volta comigo aqui mesmo na BlaBlaCar — é só procurar meu perfil!' },
    { emoji: '⭐', cor: '#f59e0b', titulo: 'Avalie 5 estrelas', texto: 'Se a viagem foi boa, 5 estrelas na BlaBlaCar fazem toda a diferença pra mim. Obrigado! 🙏' },
    { emoji: '💧', cor: '#17b978', titulo: 'Fique à vontade', texto: 'Precisa de carregador ou abaixar o ar? É só pedir. Boa viagem! 😊' },
    { emoji: '🎶', cor: '#0ea5e9', titulo: 'Sua música', texto: 'Quer ouvir alguma música na viagem? Me fala o nome que eu coloco pra tocar.' }
  ];
  const PROMO_INTERVALO = (cfg.propagandaIntervalo > 0 ? cfg.propagandaIntervalo : 150000); // entre um popup e outro (padrão 2,5 min)
  const PROMO_DURACAO   = (cfg.propagandaDuracao   > 0 ? cfg.propagandaDuracao   : 9000);    // tempo na tela (padrão 9 s)
  let promoIdx = 0, promoHideTimer = null, promoNextTimer = null, promoVivo = false;

  function promoDisponiveis() {
    const temJogo = !!urlDoJogo();
    return PROPAGANDAS.filter((a) => !a.precisaJogo || temJogo);
  }
  // Não mostra por cima de um pagamento, anúncio de cidade, agradecimento ou splash
  function promoOcupado() {
    return !splashTocado
      || document.hidden
      || $('#modalBg').classList.contains('aberto')
      || $('#anuncioBg').classList.contains('aberto')
      || $('#avaliarBg').classList.contains('aberto');
  }
  function fecharPromo() {
    clearTimeout(promoHideTimer);
    const el = $('#promo'); if (!el || !promoVivo) return;
    promoVivo = false;
    el.classList.add('saindo');
    setTimeout(() => { el.classList.remove('aberto', 'saindo'); el.setAttribute('aria-hidden', 'true'); }, 420);
  }
  function mostrarPromo() {
    const lista = promoDisponiveis();
    if (!lista.length) return;
    const a = lista[promoIdx % lista.length]; promoIdx++;
    const el = $('#promo'), card = $('#promoCard');
    if (!el || !card) return;
    card.style.setProperty('--promo-cor', a.cor || '#2a6df4');
    el.style.setProperty('--promo-dur', (PROMO_DURACAO / 1000) + 's');
    $('#promoEmoji').textContent = a.emoji || '🎁';
    $('#promoTitulo').textContent = a.titulo || '';
    $('#promoSub').textContent = a.texto || '';
    el.classList.remove('saindo'); el.classList.add('aberto'); el.setAttribute('aria-hidden', 'false');
    promoVivo = true;
    clearTimeout(promoHideTimer);
    promoHideTimer = setTimeout(fecharPromo, PROMO_DURACAO);
  }
  function agendarPromo() {
    clearTimeout(promoNextTimer);
    promoNextTimer = setTimeout(function tick() {
      if (cfg.propagandaAtiva === false) { promoNextTimer = setTimeout(tick, PROMO_INTERVALO); return; }
      if (promoOcupado()) { promoNextTimer = setTimeout(tick, 15000); return; } // ocupado agora: tenta de novo em 15s
      mostrarPromo();
      promoNextTimer = setTimeout(tick, PROMO_DURACAO + PROMO_INTERVALO); // próximo ciclo depois que este sumir
    }, PROMO_INTERVALO);
  }
  $('#promoFechar').addEventListener('click', (e) => { e.stopPropagation(); fecharPromo(); });
  $('#promo').addEventListener('click', fecharPromo); // tocar no cartão também fecha

  // -------- Tela inicial "Toque para começar" --------
  // 1 toque libera tudo de uma vez (exigência do navegador): som, voz e tela cheia.
  const inicioBg = $('#inicioBg');
  if (inicioBg) {
    inicioBg.addEventListener('click', () => {
      try { toggleFullscreen(); } catch (e) {}
      desbloquearAudio();   // libera o Web Audio (chime + voz do n8n)
      destravarVoz();       // destrava a voz do navegador (reserva)
      destravarElemento();  // destrava o elemento <audio> (foco de áudio p/ abaixar a música)
      inicioBg.classList.add('fechado');
      setTimeout(() => { inicioBg.style.display = 'none'; }, 450);
      splashTocado = true;
      falarResumoViagem();  // fala o resumo da viagem (paradas + chegada final)
    }, { once: true });
  }

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

  // -------- Sincronização automática (E-mail → n8n → kiosk) --------
  // Busca a viagem de um endpoint (n8n) e atualiza sozinho, preservando quem já pagou.
  async function sincronizar() {
    if (!cfg.viagemFeedUrl) return;
    try {
      // timeout de 90s: o n8n lê os e-mails e ficou lento (~50s); damos folga.
      // O certo é o cache no n8n (resposta instantânea) — ver automacao/email-n8n.md.
      const ctrl = new AbortController();
      const prazo = setTimeout(() => ctrl.abort(), 90000);
      const resp = await fetch(cfg.viagemFeedUrl, { cache: 'no-store', signal: ctrl.signal }).finally(() => clearTimeout(prazo));
      if (!resp.ok) return;
      const data = await resp.json();
      const nova = data && data.trip ? data.trip : data;
      if (!nova || !Array.isArray(nova.passageiros)) return;

      // Preserva "pago" só se for a MESMA viagem (mesma data/hora). Se a viagem
      // mudou (ex.: da ida para a volta, ou outro dia), zera — todos pendentes de novo.
      const local = Store.getTrip();
      const mesmaViagem = !!(local && nova.dataHora && local.dataHora === nova.dataHora);
      const pagos = {};
      if (mesmaViagem) {
        (local.passageiros || []).forEach((p) => { if (p.status === 'pago') pagos[(p.nome || '').toLowerCase()] = p.pagoEm || new Date().toISOString(); });
      }
      nova.passageiros.forEach((p, i) => {
        if (!p.id) p.id = 'p' + (i + 1);
        const k = (p.nome || '').toLowerCase();
        if (pagos[k]) { p.status = 'pago'; p.pagoEm = pagos[k]; }
        else { p.status = p.status || 'pendente'; p.pagoEm = p.pagoEm || null; }
      });

      if (JSON.stringify(nova) !== JSON.stringify(local)) {
        Store.setTrip(nova);       // guarda a viagem COMPLETA (do n8n)
        usarTrip(nova);            // e exibe SEM os "não embarcou"
        renderBanner();
        renderPassageiros();
        renderRota();
        // Se o usuário já tocou "começar" mas a viagem só chegou agora, fala o resumo
        if (splashTocado && !resumoFalado) falarResumoViagem();
      }
    } catch (e) { /* offline/erro: mantém o que já está na tela */ }
    finally {
      // Tira o "Carregando…" depois da 1ª tentativa (deu certo ou não)
      if (feedPendente) { feedPendente = false; renderBanner(); renderPassageiros(); renderRota(); }
    }
  }

  // Rebalanceia os cards e reposiciona o carrinho quando a tela muda de tamanho
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { equilibrarCards(); atualizarCarro(); }, 150);
  });

  // -------- Início --------
  aplicarZoom();
  renderBanner();
  renderPassageiros();
  renderRota();
  manterTelaAcesa();
  iniciarGeo();
  agendarPromo();
  sincronizar();
  setInterval(sincronizar, 1800000); // a cada 30 min (o botão 🔄 força na hora, se precisar)
})();

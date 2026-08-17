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
      row.className = 'item';
      row.innerHTML = `
        <label class="mini" style="${p.foto ? '' : 'background:' + corDoNome(p.nome || '?')}">
          ${p.foto ? `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : iniciais(p.nome || '?')}
          <input type="file" accept="image/*" data-foto="${i}">
        </label>
        <input class="nome" data-nome="${i}" placeholder="Nome" value="${(p.nome || '').replace(/"/g, '&quot;')}">
        <input class="valor" data-valor="${i}" type="number" step="0.01" placeholder="Valor" value="${p.valor != null ? p.valor : ''}">
        <span style="font-size:.8rem;color:var(--texto-suave)">${p.status === 'pago' ? '✓ pago' : 'pendente'}</span>
        <button class="rm" data-rm="${i}" title="Remover">✕</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll('[data-nome]').forEach((el) => el.addEventListener('input', (e) => { trip.passageiros[e.target.dataset.nome].nome = e.target.value; }));
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
        <span></span><span></span>
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
      valorPadrao: $('#valorPadrao').value === '' ? 0 : Number($('#valorPadrao').value)
    };
    trip.origem = $('#origem').value.trim();
    trip.destino = $('#destino').value.trim();
    trip.dataHora = $('#dataHora').value;
  }

  function salvar() {
    coletarConfig();
    Store.setConfig(cfg);
    Store.setTrip(trip);
    toast('Salvo! ✅ Já pode abrir o kiosk.');
  }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  $('#addPass').addEventListener('click', () => { (trip.passageiros = trip.passageiros || []).push({ id: Store.newId(), nome: '', foto: '', valor: null, status: 'pendente', pagoEm: null }); renderPassageiros(); });
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

  // Início
  carregarConfig();
  renderPassageiros();
  renderParadas();
})();

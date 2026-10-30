/*
 * store.js — Estado do app (configuração + viagem) salvo no localStorage do tablet.
 * Funciona offline e sem servidor. Também exporta/importa JSON.
 */
(function (global) {
  'use strict';

  const CFG_KEY = 'blablacar_config';
  const TRIP_KEY = 'blablacar_trip';
  const REMOV_KEY = 'blablacar_removidos'; // no-shows por viagem (dataHora)

  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const defaultConfig = {
    pixKey: '',                 // <- sua chave PIX (email, telefone, CPF ou aleatória)
    merchantName: 'MOTORISTA',  // aparece no comprovante do passageiro
    merchantCity: 'SAO PAULO',
    valorPadrao: 25,            // valor sugerido por passageiro (R$)
    // Confirmação de viagem via n8n + Evolution API (WhatsApp)
    n8nWebhookUrl: '',          // URL do webhook do seu n8n
    carroModelo: '',            // ex.: Fiat Argo
    carroCor: '',               // ex.: prata
    carroPlaca: '',             // ex.: ABC1D23
    // Sincronização automática: o kiosk lê a viagem deste endpoint (n8n).
    // É sempre o mesmo, então já fica como padrão de fábrica:
    viagemFeedUrl: 'https://n8n.safepointmarket.com.br/webhook/coleta-blablacar-kiosk',
    // Zoom da tela (1 = normal). Ajuste fino para a multimídia do carro:
    // ex.: 0.85 = tudo menor (cabe mais), 1.15 = tudo maior.
    zoom: 1,
    // Mostra o carrinho ao vivo na rota (usa a localização do navegador). false = desliga.
    rastrearCarro: true,
    // 🎮 Botão "Jogar": pacote do app Android a abrir (ex.: melonDS). '' = esconde.
    jogoPackage: 'me.magnum.melonds',
    // 📣 Carrossel de propaganda (popup que surge de tempos em tempos).
    propagandaAtiva: true,        // false = desliga os popups
    propagandaIntervalo: 150000,  // tempo ENTRE um popup e outro (ms) — padrão 2,5 min
    propagandaDuracao: 9000       // tempo que o popup fica na tela (ms) — padrão 9 s
  };

  // Viagem de exemplo (sem fotos externas: usamos as iniciais como avatar)
  const sampleTrip = {
    origem: 'São Paulo, SP',
    destino: 'Campinas, SP',
    dataHora: '2026-08-17T14:00',
    paradas: [
      { nome: 'São Paulo', foto: '' },
      { nome: 'Jundiaí', foto: '' },
      { nome: 'Valinhos', foto: '' },
      { nome: 'Campinas', foto: '' }
    ],
    passageiros: [
      { id: 'p1', nome: 'Ana Souza', foto: '', valor: 25, embarque: 'São Paulo', destino: 'Jundiaí', telefone: '+55 11 99999-0001', status: 'pendente', pagoEm: null },
      { id: 'p2', nome: 'Bruno Lima', foto: '', valor: 25, embarque: 'São Paulo', destino: 'Campinas', telefone: '+55 11 99999-0002', status: 'pendente', pagoEm: null },
      { id: 'p3', nome: 'Carla Dias', foto: '', valor: 25, embarque: 'Jundiaí', destino: 'Campinas', telefone: '+55 11 99999-0003', status: 'pendente', pagoEm: null },
      { id: 'p4', nome: 'Diego Rocha', foto: '', valor: 30, embarque: 'São Paulo', destino: 'Valinhos', telefone: '', status: 'pendente', pagoEm: null }
    ]
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredClone(fallback);
    } catch (e) {
      return structuredClone(fallback);
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const Store = {
    getConfig() {
      // defaults do código  ←  config.js (window.BLABLA_CONFIG, vale p/ todo aparelho)  ←  o que foi salvo no Admin (por aparelho)
      const base = Object.assign({}, defaultConfig, (typeof window !== 'undefined' && window.BLABLA_CONFIG) || {});
      const urlPadrao = base.viagemFeedUrl;
      const saved = read(CFG_KEY, null);
      const merged = saved ? Object.assign({}, base, saved) : base;
      // A URL do n8n é sempre a mesma: se vier vazia (config antiga salva), volta pro padrão
      if (!merged.viagemFeedUrl) merged.viagemFeedUrl = urlPadrao;
      return merged;
    },
    setConfig(cfg) {
      write(CFG_KEY, Object.assign({}, defaultConfig, cfg));
    },
    getTrip() {
      return read(TRIP_KEY, sampleTrip);
    },
    setTrip(trip) {
      write(TRIP_KEY, trip);
    },
    // Marca um passageiro como pago (ou pendente) e persiste
    setPassengerStatus(id, status) {
      const trip = this.getTrip();
      const p = (trip.passageiros || []).find((x) => x.id === id);
      if (p) {
        p.status = status;
        p.pagoEm = status === 'pago' ? new Date().toISOString() : null;
        this.setTrip(trip);
      }
      return trip;
    },
    // Zera os pagamentos para reutilizar numa próxima viagem
    resetPayments() {
      const trip = this.getTrip();
      (trip.passageiros || []).forEach((p) => {
        p.status = 'pendente';
        p.pagoEm = null;
      });
      this.setTrip(trip);
      return trip;
    },
    loadSample() {
      const t = structuredClone(sampleTrip);
      this.setTrip(t);
      return t;
    },

    // -------- No-shows (quem foi buscado mas não embarcou) --------
    // Chave estável do passageiro (nome + trecho), pra sobreviver aos syncs.
    chaveRemocao(p) { return norm(p && p.nome) + '|' + norm(p && p.embarque) + '|' + norm(p && p.destino); },
    getRemovidos(dataHora) { const all = read(REMOV_KEY, {}); return all[dataHora || ''] || []; },
    addRemovido(dataHora, p) {
      const all = read(REMOV_KEY, {}); const k = this.chaveRemocao(p);
      const arr = all[dataHora || ''] || []; if (arr.indexOf(k) < 0) arr.push(k);
      all[dataHora || ''] = arr; write(REMOV_KEY, all);
    },
    tirarRemovido(dataHora, p) {
      const all = read(REMOV_KEY, {}); const k = this.chaveRemocao(p);
      all[dataHora || ''] = (all[dataHora || ''] || []).filter((x) => x !== k); write(REMOV_KEY, all);
    },
    // Remove do objeto de viagem os passageiros marcados como "não embarcou".
    filtrarRemovidos(trip) {
      if (!trip) return trip;
      const rem = this.getRemovidos(trip.dataHora);
      if (rem.length) trip.passageiros = (trip.passageiros || []).filter((p) => rem.indexOf(this.chaveRemocao(p)) < 0);
      return trip;
    },
    newId() {
      return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    }
  };

  global.Store = Store;
})(window);

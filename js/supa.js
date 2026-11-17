/*
 * supa.js — Camada multi-motorista (Supabase).
 *
 * Fica POR CIMA do Store (localStorage). Se o Supabase não estiver configurado,
 * a lib não carregar (offline) ou o motorista não estiver logado, tudo aqui vira
 * no-op e o app continua funcionando com a config local/cacheada. Objetivo:
 * NUNCA quebrar o kiosk durante a viagem por causa de rede.
 *
 * Expõe window.BlaBlaSupa com: ready, getUser, getSession, sendMagicLink,
 * signOut, loadConfig, saveConfig.
 */
(function (global) {
  'use strict';

  const C = global.BLABLA_CONFIG || {};
  const URL_ = C.supabaseUrl || '';
  const KEY_ = C.supabaseAnonKey || '';
  const SCHEMA = 'blablapague';

  let client = null;
  function hasLib() { return typeof global.supabase !== 'undefined' && !!global.supabase.createClient; }
  function ready() { return !!(URL_ && KEY_ && hasLib()); }
  function getClient() {
    if (!ready()) return null;
    if (!client) {
      client = global.supabase.createClient(URL_, KEY_, {
        db: { schema: SCHEMA },  // todas as queries vão pro schema do produto
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  // Colunas dedicadas da tabela; o resto da config vai no jsonb `config`.
  const COLS = {
    pixKey: 'pix_key', merchantName: 'merchant_name', merchantCity: 'merchant_city',
    valorPadrao: 'valor_padrao', carroModelo: 'carro_modelo', carroCor: 'carro_cor',
    carroPlaca: 'carro_placa'
  };
  // Nunca persistir estas (são chaves públicas do deploy, não do motorista).
  const NUNCA = { supabaseUrl: 1, supabaseAnonKey: 1 };

  function rowToCfg(row) {
    if (!row) return null;
    const cfg = Object.assign({}, row.config || {});
    if (row.pix_key != null) cfg.pixKey = row.pix_key;
    if (row.merchant_name != null) cfg.merchantName = row.merchant_name;
    if (row.merchant_city != null) cfg.merchantCity = row.merchant_city;
    if (row.valor_padrao != null) cfg.valorPadrao = Number(row.valor_padrao);
    if (row.carro_modelo != null) cfg.carroModelo = row.carro_modelo;
    if (row.carro_cor != null) cfg.carroCor = row.carro_cor;
    if (row.carro_placa != null) cfg.carroPlaca = row.carro_placa;
    return cfg;
  }
  function cfgToRow(cfg) {
    const row = {}, config = {};
    Object.keys(cfg || {}).forEach((k) => {
      if (NUNCA[k]) return;
      if (COLS[k]) row[COLS[k]] = cfg[k];
      else config[k] = cfg[k];
    });
    row.config = config;
    return row;
  }

  const Supa = {
    ready: ready,
    async getUser() {
      const c = getClient(); if (!c) return null;
      try { const { data } = await c.auth.getUser(); return data ? data.user : null; } catch (e) { return null; }
    },
    async getSession() {
      const c = getClient(); if (!c) return null;
      try { const { data } = await c.auth.getSession(); return data ? data.session : null; } catch (e) { return null; }
    },
    async sendMagicLink(email, redirectTo) {
      const c = getClient(); if (!c) throw new Error('Supabase não configurado');
      const { error } = await c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
      });
      if (error) throw error;
      return true;
    },
    async signOut() { const c = getClient(); if (c) { try { await c.auth.signOut(); } catch (e) {} } },
    // Lê a config do motorista logado. null = sem Supabase/sem login/sem linha.
    // Usa getSession() (local, sem rede) pra não gerar 401 quando deslogado.
    async loadConfig() {
      const c = getClient(); if (!c) return null;
      const sess = await this.getSession(); const u = sess && sess.user; if (!u) return null;
      try {
        const { data, error } = await c.from('drivers').select('*').eq('id', u.id).maybeSingle();
        if (error) { console.warn('[supa] loadConfig:', error.message); return null; }
        return rowToCfg(data);
      } catch (e) { console.warn('[supa] loadConfig:', e.message); return null; }
    },
    // Salva (upsert) a config do motorista logado.
    async saveConfig(cfg) {
      const c = getClient(); if (!c) throw new Error('Supabase não configurado');
      const sess = await this.getSession(); const u = sess && sess.user; if (!u) throw new Error('Faça login primeiro');
      const row = cfgToRow(cfg); row.id = u.id; row.email = u.email;
      const { error } = await c.from('drivers').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return true;
    }
  };

  global.BlaBlaSupa = Supa;
})(window);

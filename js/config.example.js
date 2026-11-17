/*
 * config.example.js — MODELO de configuração.
 *
 * Copie este arquivo para "config.js" (na mesma pasta) e preencha os seus dados.
 * O "config.js" real fica FORA do Git (tem dados pessoais, como a chave PIX).
 *
 * Assim TODO dispositivo que abrir o app já vem configurado, sem salvar nada.
 */
window.BLABLA_CONFIG = {
  // 🏢 Backend multi-motorista (Supabase) — chaves PÚBLICAS (seguras no navegador).
  //    Com isso o motorista entra com o e-mail (link mágico) e o kiosk carrega a
  //    config DELE. As chaves abaixo são "publicáveis": podem ficar no código.
  supabaseUrl: 'https://aplhxqxhffceqiyquqtk.supabase.co',
  supabaseAnonKey: 'sb_publishable_ak51E4zYwzqmaFoLLqtpcA_vlHY1gDx',

  // ── Config single-user (fallback) ──────────────────────────────────────────
  //   Com o multi-motorista ligado, os campos abaixo (pixKey, nome, carro…)
  //   passam a vir da CONTA do motorista no Supabase. Ficam aqui só como padrão
  //   inicial / modo offline sem login.
  // 💸 Sua chave PIX (telefone no formato +55DDDNUMERO, email, CPF ou aleatória):
  pixKey: '',
  merchantName: 'Paulo',      // nome que aparece no comprovante do passageiro
  merchantCity: 'Botucatu',
  valorPadrao: 23,            // valor sugerido quando o e-mail não trouxer o valor

  // 📺 Zoom da tela — ajuste fino p/ a multimídia do carro (1 = normal):
  //    0.85 = tudo menor (cabe mais); 1.15 = tudo maior. Ache o que preenche bem a tela.
  zoom: 1,

  // 🚗 Carrinho ao vivo na rota (localização do navegador). false = desliga.
  rastrearCarro: true,

  // 🎮 Botão "Jogar" (abre um app Android na multimídia). Informe o PACOTE do
  //    app; '' esconde o botão. Ex.: melonDS = 'me.magnum.melonds'.
  //    (Dica: pra descobrir o pacote, veja a URL do app na Play Store:
  //     .../store/apps/details?id=PACOTE). Pra abrir em tela dividida, deixe o
  //    navegador em split-screen antes — o botão abre o jogo no outro lado.
  jogoPackage: 'me.magnum.melonds',
  // Opcional: sobrescreve com um link/Intent completo (ex.: 'waze://?...').
  // jogoUrl: '',

  // 🔔 Ao chegar na cidade: som de aeroporto (somEmbarque) e falar os nomes
  //    de quem embarca/desembarca (falarNomes). false em qualquer um desliga.
  somEmbarque: true,
  falarNomes: true,
  // 🔊 Volume do chime e da voz (amplificação acima do normal, com limitador
  //    pra não estourar). 1 = normal, 5 = bem mais alto, 6–8 = máximo.
  volumeBoost: 5,
  // 🗣️ Voz MÃOS LIVRES no Android: endpoint do n8n que gera o MP3 da frase.
  //    Vazio = usa a voz do navegador (no Android pode exigir um toque).
  //    Ex.: 'https://n8n.safepointmarket.com.br/webhook/tts-blablacar'
  ttsUrl: '',

  // 🔄 O endpoint do n8n já é padrão de fábrica (js/store.js). Só descomente
  //    a linha abaixo se um dia mudar o n8n:
  // viagemFeedUrl: 'https://n8n.safepointmarket.com.br/webhook/coleta-blablacar-kiosk',

  // 🚗 Carro (opcional — só para a confirmação por WhatsApp):
  carroModelo: '',
  carroCor: '',
  carroPlaca: '',
  n8nWebhookUrl: ''
};

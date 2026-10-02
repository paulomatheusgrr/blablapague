/*
 * config.example.js — MODELO de configuração.
 *
 * Copie este arquivo para "config.js" (na mesma pasta) e preencha os seus dados.
 * O "config.js" real fica FORA do Git (tem dados pessoais, como a chave PIX).
 *
 * Assim TODO dispositivo que abrir o app já vem configurado, sem salvar nada.
 */
window.BLABLA_CONFIG = {
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

  // 🔔 Ao chegar na cidade: som de aeroporto (somEmbarque) e falar os nomes
  //    de quem embarca/desembarca (falarNomes). false em qualquer um desliga.
  somEmbarque: true,
  falarNomes: true,
  // 🔊 Volume do chime e da voz (amplificação acima do normal, com limitador
  //    pra não estourar). 1 = normal, 3 = bem mais alto, 4–5 = máximo.
  volumeBoost: 3,
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

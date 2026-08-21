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

  // 🔄 O endpoint do n8n já é padrão de fábrica (js/store.js). Só descomente
  //    a linha abaixo se um dia mudar o n8n:
  // viagemFeedUrl: 'https://n8n.safepointmarket.com.br/webhook/coleta-blablacar-kiosk',

  // 🚗 Carro (opcional — só para a confirmação por WhatsApp):
  carroModelo: '',
  carroCor: '',
  carroPlaca: '',
  n8nWebhookUrl: ''
};

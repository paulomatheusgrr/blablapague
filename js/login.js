/*
 * login.js — Envia o link mágico (magic link) do Supabase pro e-mail do motorista.
 * Ao clicar no link do e-mail, o motorista volta já logado em admin.html.
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const form = $('#loginForm'), okBox = $('#okBox'), msg = $('#msg');

  function erro(txt) { msg.className = 'login-msg erro'; msg.textContent = txt; }
  function limpaMsg() { msg.className = 'login-msg'; msg.textContent = ''; }

  // Pra onde o link do e-mail traz de volta (mesma origem, já logado).
  function redirectTo() {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + 'admin.html';
  }

  // Se não dá pra usar o Supabase (lib/CDN bloqueada ou config faltando), avisa.
  if (!window.BlaBlaSupa || !BlaBlaSupa.ready()) {
    erro('Login indisponível: Supabase não configurado neste aparelho (veja js/config.js) ou sem internet.');
    const b = $('#btnEnviar'); if (b) b.disabled = true;
  } else {
    // Já está logado? vai direto pro Admin.
    BlaBlaSupa.getSession().then((s) => { if (s) location.href = 'admin.html'; });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpaMsg();
    const email = $('#email').value.trim();
    if (!email) return;
    const btn = $('#btnEnviar');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await BlaBlaSupa.sendMagicLink(email, redirectTo());
      $('#okEmail').textContent = email;
      form.classList.add('off');
      okBox.classList.add('on');
    } catch (err) {
      erro('Não consegui enviar: ' + (err && err.message ? err.message : 'erro desconhecido'));
      btn.disabled = false; btn.textContent = '✉️ Enviar link de acesso';
    }
  });

  const tentar = $('#tentarDeNovo');
  if (tentar) tentar.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });
})();

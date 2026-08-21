# Hospedar o BlaBlaPague na Hostinger

Assim o app fica num endereço fixo (https) e **qualquer aparelho** (celular ou
tablet) abre a mesma versão, já configurado — sem precisar salvar nada.

## 1) Antes de subir: preencha o `config.js`
Abra **`js/config.js`** e preencha a sua **chave PIX** (o resto já vem pronto):
```js
pixKey: 'sua-chave-pix-aqui',   // email, telefone, CPF ou aleatória
```
O `viagemFeedUrl` (endpoint do n8n) já está preenchido. Se quiser, ajuste
`merchantName`, `merchantCity`, `valorPadrao` e os dados do carro.

## 2) O que subir (só o "site")
Envie **estes arquivos/pastas** para a pasta **`public_html`** da Hostinger:
```
index.html
admin.html
bookmarklet.html
css/          (styles.css)
js/           (app.js, admin.js, store.js, pix.js, qrcode.js, config.js)
```
**Não precisa subir**: `automacao/`, `node_modules/`, `dev-server.js`,
`package.json`, `README.md`, `.gitignore`, `.git/`. (São coisas de
desenvolvimento/n8n — o site não usa.)

## 3) Como subir (hPanel da Hostinger)
1. Entre no **hPanel** → **Sites** → seu site → **Gerenciador de Arquivos**.
2. Abra a pasta **`public_html`**.
3. Clique em **Upload** e envie os arquivos, **mantendo as pastas** `css/` e `js/`
   (o jeito mais fácil é compactar em `.zip`, subir o zip e usar **Extrair** ali mesmo).
4. Confirme que ficou assim: `public_html/index.html`, `public_html/js/app.js`, etc.

## 4) Abrir
- Kiosk (tablet): `https://SEU-DOMINIO/` (ou `/index.html`)
- Admin (motorista): `https://SEU-DOMINIO/admin.html`
- Botão mágico: `https://SEU-DOMINIO/bookmarklet.html`

> Coloque num **subdiretório**? Ex.: subir em `public_html/pague/` → acessa em
> `https://SEU-DOMINIO/pague/`. Funciona igual (os caminhos são relativos).

## 5) Dicas
- A Hostinger já serve em **https** (bom para o "manter tela acesa" e para o
  armazenamento funcionar direito no celular).
- Atualizou algo? Suba o arquivo novo por cima e recarregue a página (se não
  atualizar, force o refresh limpando o cache).
- **Privacidade:** o endpoint do n8n é aberto (sem senha) e devolve nomes/valores
  dos passageiros. Se quiser, dá pra proteger depois (token na URL). Me avise.

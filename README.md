# 🚗 BlaBlaPague — Kiosk de pagamento PIX para caronas

Página para deixar aberta num **tablet** durante a viagem. O passageiro toca na
própria foto, aparece um **QR Code PIX** com o valor já preenchido para a sua
conta, ele paga e a tela mostra **"✓ Pago"** com uma animação divertida.
Também mostra a rota e as paradas.

Funciona **100% offline, sem servidor e sem instalar nada** — é só abrir o
`index.html` no navegador do tablet.

---

## ▶️ Como usar

1. **Abra o `index.html`** no navegador (Chrome, Edge, etc.). No tablet, dê um
   duplo-toque no arquivo ou arraste-o para o navegador.
2. Toque no botão **⚙️** (canto inferior direito) para abrir a **Configuração**:
   - **Sua chave PIX** (email, telefone, CPF ou chave aleatória) → é ela que
     recebe o dinheiro.
   - **Nome do recebedor** e **Cidade** (aparecem no comprovante do passageiro).
   - **Valor padrão** por passageiro.
   - **Viagem**: origem, destino, data/hora.
   - **Passageiros**: nome, valor e foto (toque no círculo colorido para escolher
     a foto; sem foto, mostramos as iniciais).
   - **Paradas** da rota (com foto opcional).
3. Toque em **💾 Salvar** e volte ao kiosk (**← Voltar ao kiosk**).
4. Pronto: deixe o kiosk aberto. A cada passageiro que toca na foto → QR PIX.

> **Antes de cada nova viagem**, entre no ⚙️ e use **↺ Zerar pagamentos** para
> todos voltarem a "pendente" (ou ajuste os passageiros).

---

## 💸 Como o pagamento é confirmado (Modelo A — atual)

- O QR é um **PIX estático** gerado no próprio tablet com a sua chave e o valor.
- Quando o passageiro paga, **cai na hora na sua conta** e o **seu banco te avisa**
  ("Você recebeu R$ X de Fulano").
- Aí é só tocar em **"✅ Já paguei"** no tablet → animação de "pago".
- **A validação é a notificação do seu banco.** Simples, grátis, sem cadastro.

Quer que o tablet marque "pago" **sozinho**, sem ninguém tocar em nada? Veja a
**Fase 2** (Modelo B) em [`automacao/LEIA-ME.md`](automacao/LEIA-ME.md).

---

## 📱 Dica: modo quiosque no tablet

- **Mantenha a tela sempre ligada**: nas configurações do tablet, aumente o tempo
  de suspensão ou use um app de "keep screen on".
- **Trave numa página só**: Android tem "Fixação de tela"; iPad tem "Acesso
  Guiado" (Ajustes › Acessibilidade). Assim o passageiro não sai do app.
- **Tela cheia**: no Chrome/Edge, use F11 (ou "Adicionar à tela inicial" para
  abrir sem barra de endereço).

---

## 🔒 Privacidade

- **Tudo fica salvo só no tablet** (no `localStorage` do navegador). Sua chave
  PIX, fotos e dados dos passageiros **nunca são enviados para a internet**.
- Fotos e nomes de passageiros são dados pessoais (LGPD). Depois da viagem, use
  **↺ Zerar pagamentos** ou remova os passageiros no ⚙️.

---

## 🗂️ Estrutura dos arquivos

```
Blablacar/
├── index.html            Kiosk (tela dos passageiros)
├── admin.html            Configuração (motorista)
├── css/styles.css        Visual
├── js/
│   ├── config.js         Config do deploy (chave PIX, etc.) — fora do Git
│   ├── config.example.js Modelo do config.js
│   ├── pix.js            Gera o "copia e cola" PIX (BR Code/EMV + CRC16)
│   ├── qrcode.js         Biblioteca de QR Code (MIT, Kazuhiko Arase)
│   ├── store.js          Config + viagem (localStorage)
│   ├── app.js            Lógica do kiosk (+ sincronização com o n8n)
│   └── admin.js          Lógica da configuração
└── automacao/            n8n (E-mail → viagem): workflow + parser + docs
```

---

## 🔄 Atualização automática (E-mail → n8n → kiosk)

Os passageiros aparecem no tablet **sozinhos**: um fluxo no **n8n** lê os e-mails
da BlaBlaCar (reservas e cancelamentos), remonta a próxima viagem — com nome,
foto, trajeto e valor — e o kiosk consulta esse endpoint e se atualiza (a cada
5 min, ou na hora pelo botão **🔄** no canto da tela).

O parser e o workflow para importar no n8n estão em
[`automacao/email-n8n.md`](automacao/email-n8n.md).

> Confirmação por WhatsApp (avisar os passageiros) é opcional, documentada em
> [`automacao/n8n-evolution.md`](automacao/n8n-evolution.md).

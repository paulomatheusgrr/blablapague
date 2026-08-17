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
├── index.html        Kiosk (tela dos passageiros)
├── admin.html        Configuração (motorista)
├── bookmarklet.html  "Botão Mágico" p/ importar a viagem da BlaBlaCar
├── css/styles.css    Visual
├── js/
│   ├── pix.js        Gera o "copia e cola" PIX (BR Code/EMV + CRC16)
│   ├── qrcode.js     Biblioteca de QR Code (MIT, Kazuhiko Arase)
│   ├── store.js      Salva config e viagem no tablet
│   ├── app.js        Lógica do kiosk
│   └── admin.js      Lógica da configuração
└── automacao/        Fase 2 (opcional): automação BlaBlaCar + PIX automático
```

---

## 🪄 Importar a viagem da BlaBlaCar (Botão Mágico)

Em vez de digitar os passageiros na mão, use o **botão mágico**: ele lê a sua
viagem direto da BlaBlaCar (no seu navegador normal, logado) e traz nome, foto,
rota **e o valor de cada passageiro** para o kiosk. Abra **[`bookmarklet.html`](bookmarklet.html)** e siga o
passo a passo (instalar uma vez → clicar em cada viagem → Importar JSON no Admin).

> Não é um robô automático de fim a fim porque a BlaBlaCar bloqueia navegadores
> automatizados (proteção anti-robô). O botão mágico contorna isso de forma
> legítima: é você navegando + um clique. Detalhes em
> [`automacao/LEIA-ME.md`](automacao/LEIA-ME.md).

## 🚀 Próximo passo opcional (Fase 2)

- **Modelo B — confirmação automática**: cobrança PIX dinâmica via provedor
  (Efí / Mercado Pago / Asaas) que avisa o app assim que o passageiro paga —
  o tablet marca "pago" sozinho. Precisa de Node.js + backend. Ver
  [`automacao/LEIA-ME.md`](automacao/LEIA-ME.md).

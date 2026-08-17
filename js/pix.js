/*
 * pix.js — Gerador de payload PIX "Copia e Cola" (BR Code / EMV) 100% no navegador.
 * Formato oficial do Banco Central (EMVCo) com CRC16-CCITT.
 * Nada aqui vai para a internet: a chave PIX nunca sai do dispositivo.
 */
(function (global) {
  'use strict';

  // Monta um campo TLV: id (2) + tamanho (2, com zero à esquerda) + valor
  function tlv(id, value) {
    const v = String(value);
    return id + String(v.length).padStart(2, '0') + v;
  }

  // CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) — exigido pelo campo 63
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Nome/cidade do recebedor: só A-Z 0-9 e espaço, sem acento, maiúsculas
  function sanitize(str, max) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .toUpperCase()
      .trim()
      .slice(0, max);
  }

  /**
   * Gera o payload PIX (string do "copia e cola").
   * @param {object} o
   * @param {string} o.key    Chave PIX (email, telefone, CPF, aleatória)
   * @param {number} [o.amount] Valor em reais (ex.: 25.5). Omitido = valor livre.
   * @param {string} o.name   Nome do recebedor (máx. 25)
   * @param {string} o.city   Cidade do recebedor (máx. 15)
   * @param {string} [o.txid] Identificador da transação (máx. 25). "***" se vazio.
   * @returns {string} payload completo com CRC
   */
  function buildPix(o) {
    const key = String(o.key || '').trim();
    if (!key) throw new Error('Chave PIX não configurada');

    const merchantAccount = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key));
    const amount =
      o.amount != null && o.amount !== '' && !isNaN(Number(o.amount))
        ? tlv('54', Number(o.amount).toFixed(2))
        : '';
    const txidRaw = o.txid ? sanitize(o.txid, 25) : '';
    const txid = txidRaw || '***';
    const additional = tlv('62', tlv('05', txid));

    let payload =
      tlv('00', '01') +            // Payload Format Indicator
      merchantAccount +            // Merchant Account Information (PIX)
      tlv('52', '0000') +          // Merchant Category Code
      tlv('53', '986') +           // Moeda: BRL
      amount +                     // Valor (opcional)
      tlv('58', 'BR') +            // País
      tlv('59', sanitize(o.name, 25) || 'RECEBEDOR') +
      tlv('60', sanitize(o.city, 15) || 'CIDADE') +
      additional +
      '6304';                      // Campo do CRC (id 63, tam 04) — CRC calculado sobre isto

    return payload + crc16(payload);
  }

  global.Pix = { buildPix, crc16 };
})(window);

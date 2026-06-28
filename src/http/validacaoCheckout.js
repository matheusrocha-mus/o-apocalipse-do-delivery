'use strict';

/** Padrão simples de e-mail: algo@dominio.tld (RN01). */
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ehEmailValido(email) {
  return typeof email === 'string' && PADRAO_EMAIL.test(email);
}

function ehValorValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

function ehCartaoValido(cartao) {
  return Boolean(cartao && cartao.numero && cartao.validade && cartao.cvv);
}

/**
 * Validação de contrato do payload de checkout (RF01 / Fluxo 5).
 * Roda na camada de controle, ANTES de tocar banco ou gateway.
 */
function validarPayloadCheckout(body) {
  const { clienteEmail, valor, cartao } = body || {};
  const erros = [];

  if (!ehEmailValido(clienteEmail)) {
    erros.push('clienteEmail ausente ou inválido');
  }
  if (!ehValorValido(valor)) {
    erros.push('valor deve ser numérico e maior que zero');
  }
  if (!ehCartaoValido(cartao)) {
    erros.push('cartao deve conter numero, validade e cvv');
  }

  return { valido: erros.length === 0, erros };
}

module.exports = { validarPayloadCheckout, ehEmailValido, ehValorValido, ehCartaoValido };

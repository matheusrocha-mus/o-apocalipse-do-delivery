'use strict';

/** Códigos de erro de rede que justificam retentativa (RN05). */
const CODIGOS_REDE = Object.freeze(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND']);

/**
 * Classifica se um erro lançado pelo gateway é uma falha de infraestrutura
 * elegível a retentativa (RN05): timeout, HTTP 5xx ou erro de conexão.
 *
 * Falhas de negócio (cartão recusado, saldo insuficiente) chegam como RESPOSTA
 * — nunca como exceção — portanto não passam por aqui e não são retentadas.
 */
function ehErroDeInfra(erro) {
  if (!erro) {
    return false;
  }
  if (CODIGOS_REDE.includes(erro.code)) {
    return true;
  }
  if (typeof erro.status === 'number' && erro.status >= 500) {
    return true;
  }
  return false;
}

module.exports = { ehErroDeInfra, CODIGOS_REDE };

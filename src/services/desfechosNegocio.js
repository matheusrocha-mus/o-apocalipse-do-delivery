'use strict';

/**
 * Replace Conditional with Polymorphism / table lookup (Fowler).
 *
 * Em vez de uma cadeia de if/else sobre `resposta.status`, mapeamos cada status
 * do gateway para o seu desfecho de negócio: o status final do pedido e se o
 * e-mail de confirmação deve ser disparado. Adicionar um novo status passa a ser
 * uma entrada na tabela, não um novo ramo condicional.
 */
const DESFECHOS = Object.freeze({
  APROVADO: { statusPedido: 'PROCESSADO', enviarEmail: true },
  RECUSADO: { statusPedido: 'FALHOU', enviarEmail: false },
  SALDO_INSUFICIENTE: { statusPedido: 'FALHOU', enviarEmail: false },
  CARTAO_EXPIRADO: { statusPedido: 'FALHOU', enviarEmail: false },
});

/** Qualquer status desconhecido é tratado, por segurança, como falha de negócio. */
const DESFECHO_PADRAO = Object.freeze({ statusPedido: 'FALHOU', enviarEmail: false });

function resolverDesfecho(status) {
  return DESFECHOS[status] || DESFECHO_PADRAO;
}

module.exports = { resolverDesfecho, DESFECHOS, DESFECHO_PADRAO };

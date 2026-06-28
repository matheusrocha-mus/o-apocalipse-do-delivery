'use strict';

const { resolverDesfecho, DESFECHO_PADRAO } = require('../../src/services/desfechosNegocio');

describe('resolverDesfecho', () => {
  it('APROVADO => PROCESSADO e envia e-mail', () => {
    expect(resolverDesfecho('APROVADO')).toEqual({ statusPedido: 'PROCESSADO', enviarEmail: true });
  });

  it.each(['RECUSADO', 'SALDO_INSUFICIENTE', 'CARTAO_EXPIRADO'])(
    '%s => FALHOU e NÃO envia e-mail',
    (status) => {
      expect(resolverDesfecho(status)).toEqual({ statusPedido: 'FALHOU', enviarEmail: false });
    },
  );

  it('status desconhecido cai no desfecho padrão (FALHOU, sem e-mail)', () => {
    expect(resolverDesfecho('QUALQUER')).toBe(DESFECHO_PADRAO);
    expect(resolverDesfecho(undefined)).toBe(DESFECHO_PADRAO);
  });
});

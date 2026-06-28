'use strict';

const { validarPayloadCheckout } = require('../../src/http/validacaoCheckout');
const { umPedido } = require('../builders/PedidoBuilder');

describe('validarPayloadCheckout (Fluxo 5 - contrato)', () => {
  it('aceita um payload completo e válido', () => {
    const { valido, erros } = validarPayloadCheckout(umPedido().build());
    expect(valido).toBe(true);
    expect(erros).toHaveLength(0);
  });

  it('rejeita e-mail sem formato válido', () => {
    const { valido, erros } = validarPayloadCheckout(umPedido().comEmail('sem-arroba').build());
    expect(valido).toBe(false);
    expect(erros).toContain('clienteEmail ausente ou inválido');
  });

  it.each([0, -1, '100', null, NaN])('rejeita valor inválido (%p)', (valor) => {
    const { valido } = validarPayloadCheckout(umPedido().comValor(valor).build());
    expect(valido).toBe(false);
  });

  it('rejeita pedido sem cartão', () => {
    const { valido, erros } = validarPayloadCheckout(umPedido().semCartao().build());
    expect(valido).toBe(false);
    expect(erros).toContain('cartao deve conter numero, validade e cvv');
  });

  it('rejeita cartão incompleto (sem cvv)', () => {
    const { valido } = validarPayloadCheckout(
      umPedido().comCartao({ numero: '4111', validade: '12/30' }).build(),
    );
    expect(valido).toBe(false);
  });

  it('rejeita corpo ausente sem lançar exceção', () => {
    expect(validarPayloadCheckout(undefined).valido).toBe(false);
  });
});

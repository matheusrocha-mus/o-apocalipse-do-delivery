'use strict';

const { validarPayloadCheckout } = require('../../src/http/validacaoCheckout');
const { umPedido } = require('../builders/PedidoBuilder');

describe('validarPayloadCheckout (Fluxo 5 - contrato)', () => {
  it('aceita um payload completo e válido', () => {
    const { valido, erros } = validarPayloadCheckout(umPedido().build());
    expect(valido).toBe(true);
    expect(erros).toHaveLength(0);
  });

  it.each([
    'sem-arroba',
    'plainaddress',
    '@semlocal.com',
    'a@semtld',
    'a@.com',
    'a@b.',
    'a@@b.com',
    ' a@b.com', // espaço inicial: exercita a âncora ^
    'a@b.com ', // espaço final: exercita a âncora $
  ])('rejeita e-mail mal formado (%p)', (email) => {
    const { valido, erros } = validarPayloadCheckout(umPedido().comEmail(email).build());
    expect(valido).toBe(false);
    expect(erros).toContain('clienteEmail ausente ou inválido');
  });

  it('rejeita e-mail que não é string mesmo que coerça para um padrão válido', () => {
    // ['a@b.com'] vira "a@b.com" se coagido — o typeof guard precisa barrar.
    const { valido } = validarPayloadCheckout(umPedido().comEmail(['a@b.com']).build());
    expect(valido).toBe(false);
  });

  it('aceita e-mail válido no limite mínimo (a@b.co)', () => {
    expect(validarPayloadCheckout(umPedido().comEmail('a@b.co').build()).valido).toBe(true);
  });

  it.each([0, -1, '100', null, NaN, Infinity, -Infinity, true])(
    'rejeita valor inválido (%p)',
    (valor) => {
      const { valido, erros } = validarPayloadCheckout(umPedido().comValor(valor).build());
      expect(valido).toBe(false);
      expect(erros).toContain('valor deve ser numérico e maior que zero');
    },
  );

  it('aceita o menor valor positivo possível', () => {
    expect(validarPayloadCheckout(umPedido().comValor(0.01).build()).valido).toBe(true);
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

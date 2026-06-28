'use strict';

/**
 * Data Builder + Object Mother (Test Patterns).
 *
 * Elimina o Test Smell "Obscure Setup": cada teste declara só o que é relevante
 * para o cenário e o resto vem de um padrão válido. A API fluente deixa a
 * intenção explícita (ex.: `umPedido().comValor(0).build()`).
 */
class PedidoBuilder {
  constructor() {
    this.pedido = {
      clienteEmail: 'cliente@entregaja.com',
      valor: 100.0,
      cartao: { numero: '4111111111111111', validade: '12/30', cvv: '123' },
      status: 'PENDENTE',
    };
  }

  comEmail(clienteEmail) {
    this.pedido.clienteEmail = clienteEmail;
    return this;
  }

  comValor(valor) {
    this.pedido.valor = valor;
    return this;
  }

  comCartao(cartao) {
    this.pedido.cartao = cartao;
    return this;
  }

  semCartao() {
    delete this.pedido.cartao;
    return this;
  }

  comStatus(status) {
    this.pedido.status = status;
    return this;
  }

  build() {
    return { ...this.pedido, cartao: this.pedido.cartao ? { ...this.pedido.cartao } : undefined };
  }
}

/** Object Mother: ponto de entrada para um pedido válido padrão. */
function umPedido() {
  return new PedidoBuilder();
}

module.exports = { PedidoBuilder, umPedido };

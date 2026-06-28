'use strict';

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const { CheckoutService } = require('../../src/services/CheckoutService');
const { CircuitBreaker } = require('../../src/resilience/CircuitBreaker');
const { umPedido } = require('../../test/builders/PedidoBuilder');
const {
  gatewayQueResponde,
  gatewayInstavel,
  gatewayForaDoAr,
} = require('../support/dublesManuais');

const drenarPromises = () => Promise.resolve().then(() => Promise.resolve());

// --- Contexto ---------------------------------------------------------------

Given('um pedido válido de R$ 100,00', function () {
  this.pedido = umPedido().comValor(100.0).build();
});

// --- Configuração do gateway ------------------------------------------------

Given('que o gateway responde {string}', function (status) {
  this.gateway = gatewayQueResponde(status);
});

Given('que o gateway falha 1 vez por instabilidade e depois responde {string}', function (status) {
  this.gateway = gatewayInstavel(1, status);
});

Given('que o gateway está fora do ar permanentemente', function () {
  this.gateway = gatewayForaDoAr();
});

Given('que o disjuntor já está aberto por excesso de falhas de rede', function () {
  this.gateway = gatewayQueResponde('APROVADO');
  this.circuitBreaker = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 1 });
  this.circuitBreaker.registrarFalha(); // 100% de erro => aberto
});

// --- Ação --------------------------------------------------------------------

When('o checkout é processado', async function () {
  const servico = new CheckoutService(this.gateway, this.repositorio, this.email, {
    relogio: this.relogio,
    circuitBreaker: this.circuitBreaker,
  });
  try {
    this.resultado = await servico.processar(this.pedido);
  } catch (erro) {
    this.lancouExcecao = true;
    this.erro = erro;
  }
  await drenarPromises();
});

// --- Asserções ---------------------------------------------------------------

Then('o pedido deve terminar com status {string}', function (status) {
  assert.equal(this.resultado.status, status);
});

Then('o e-mail de confirmação deve ser enviado', function () {
  assert.equal(this.email.enviarConfirmacao.chamadas.length, 1);
});

Then('o e-mail de confirmação não deve ser enviado', function () {
  assert.equal(this.email.enviarConfirmacao.chamadas.length, 0);
});

Then('o gateway deve ter sido chamado {int} vezes', function (vezes) {
  assert.equal(this.gateway.cobrar.chamadas.length, vezes);
});

Then('o gateway não deve ser chamado', function () {
  assert.equal(this.gateway.cobrar.chamadas.length, 0);
});

Then('nenhuma exceção deve ter derrubado o serviço', function () {
  assert.equal(this.lancouExcecao, false);
});

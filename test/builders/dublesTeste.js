'use strict';

const { TimeoutError } = require('../../src/resilience/clock');

/**
 * Test Doubles (Meszaros): Stubs para controlar ESTADO e Mocks (jest.fn) para
 * asserção de COMPORTAMENTO.
 */

/** Stub de gateway que sempre devolve o mesmo status de negócio. */
function gatewayQueResponde(status) {
  return { cobrar: jest.fn().mockResolvedValue({ status }) };
}

/** Stub de gateway que falha `vezes` com erro de infra e depois responde `status`. */
function gatewayInstavel(vezes, status = 'APROVADO', erro = erroDeInfra()) {
  const cobrar = jest.fn();
  for (let i = 0; i < vezes; i += 1) {
    cobrar.mockRejectedValueOnce(erro);
  }
  cobrar.mockResolvedValue({ status });
  return { cobrar };
}

/** Stub de gateway que falha sempre com erro de infra (queda total). */
function gatewayForaDoAr(erro = erroDeInfra()) {
  return { cobrar: jest.fn().mockRejectedValue(erro) };
}

/** Stub de repositório que ecoa o pedido salvo acrescido de um id. */
function repositorioEmMemoria() {
  return { salvar: jest.fn(async (pedido) => ({ ...pedido, id: 1 })) };
}

/** Mock de e-mail para asserção de comportamento (foi/ não foi chamado). */
function emailMock() {
  return { enviarConfirmacao: jest.fn().mockResolvedValue(undefined) };
}

/** Erro de infraestrutura genérico (HTTP 5xx). */
function erroDeInfra(status = 503) {
  const erro = new Error('Gateway indisponível');
  erro.status = status;
  return erro;
}

/** Erro de conexão recusada. */
function erroConexao() {
  const erro = new Error('Conexão recusada');
  erro.code = 'ECONNREFUSED';
  return erro;
}

/**
 * Relógio falso e determinístico injetado no serviço: não espera de verdade,
 * apenas registra os tempos pedidos. `comTimeout` é pass-through (o controle do
 * timeout real é coberto em clock.test.js).
 */
function relogioFake() {
  return {
    aguardar: jest.fn().mockResolvedValue(undefined),
    comTimeout: jest.fn((promessa) => promessa),
  };
}

/** Drena a fila de microtasks para que efeitos "fire-and-forget" (e-mail) ocorram. */
async function drenarPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

module.exports = {
  gatewayQueResponde,
  gatewayInstavel,
  gatewayForaDoAr,
  repositorioEmMemoria,
  emailMock,
  erroDeInfra,
  erroConexao,
  relogioFake,
  drenarPromises,
  TimeoutError,
};

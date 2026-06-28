'use strict';

const { setWorldConstructor, World } = require('@cucumber/cucumber');
const { repositorioEmMemoria, emailEspiao, relogioInstantaneo } = require('./dublesManuais');

/**
 * World compartilhado entre os steps de um cenário. Centraliza os dublês e o
 * estado, evitando variáveis globais e Obscure Setup.
 */
class CheckoutWorld extends World {
  constructor(opcoes) {
    super(opcoes);
    this.gateway = null;
    this.repositorio = repositorioEmMemoria();
    this.email = emailEspiao();
    this.relogio = relogioInstantaneo;
    this.circuitBreaker = undefined;
    this.pedido = null;
    this.resultado = null;
    this.lancouExcecao = false;
  }
}

setWorldConstructor(CheckoutWorld);

'use strict';

const ESTADOS = Object.freeze({ FECHADO: 'FECHADO', ABERTO: 'ABERTO' });

/**
 * Circuit Breaker de implementação própria (RN07).
 *
 * Acumula sucessos e falhas de *rede* e considera o disjuntor ABERTO quando,
 * a partir de um volume mínimo de chamadas, a taxa de erro ultrapassa o limite
 * configurado (> 50% por padrão). Falhas de negócio (ex.: cartão recusado) NÃO
 * são registradas como falha aqui — apenas instabilidades de infraestrutura.
 */
class CircuitBreaker {
  constructor({ limiteErro = 0.5, volumeMinimo = 4 } = {}) {
    this.limiteErro = limiteErro;
    this.volumeMinimo = volumeMinimo;
    this.sucessos = 0;
    this.falhas = 0;
  }

  get total() {
    return this.sucessos + this.falhas;
  }

  get taxaErro() {
    if (this.total === 0) {
      return 0;
    }
    return this.falhas / this.total;
  }

  get estado() {
    return this.aberto() ? ESTADOS.ABERTO : ESTADOS.FECHADO;
  }

  /** Disjuntor aberto: já houve volume mínimo e a taxa de erro estourou o limite. */
  aberto() {
    if (this.total < this.volumeMinimo) {
      return false;
    }
    return this.taxaErro > this.limiteErro;
  }

  registrarSucesso() {
    this.sucessos += 1;
  }

  registrarFalha() {
    this.falhas += 1;
  }
}

module.exports = { CircuitBreaker, ESTADOS };

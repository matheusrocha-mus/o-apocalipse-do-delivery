'use strict';

const ESTADOS = Object.freeze({
  FECHADO: 'FECHADO',
  ABERTO: 'ABERTO',
  MEIO_ABERTO: 'MEIO_ABERTO',
});

/**
 * Circuit Breaker de implementação própria (RN07 + recuperação da Fase 4/SRE).
 *
 * Avalia a taxa de erro de *rede* sobre uma JANELA DESLIZANTE das últimas N
 * chamadas (não desde sempre) — assim o disjuntor reage a instabilidades
 * recentes e não fica "anestesiado" por um histórico de sucessos. ABRE quando,
 * havendo ao menos `volumeMinimo` chamadas na janela, a taxa de erro ultrapassa
 * o limite (> 50% por padrão). Falhas de negócio (cartão recusado) NÃO contam —
 * apenas instabilidades de infraestrutura.
 *
 * Máquina de estados:
 *   FECHADO ──(taxa de erro > limite)──▶ ABERTO
 *   ABERTO ──(cooldown decorrido)──▶ MEIO_ABERTO   (libera 1 requisição de sondagem)
 *   MEIO_ABERTO ──(sondagem OK)──▶ FECHADO         (recuperação → habilita o MTTR)
 *   MEIO_ABERTO ──(sondagem falha)──▶ ABERTO       (reabre, reinicia o cooldown)
 *
 * O relógio (`agora`) é injetável para tornar o cooldown determinístico nos testes.
 */
class CircuitBreaker {
  constructor({
    limiteErro = 0.5,
    volumeMinimo = 4,
    janela = 20,
    cooldownMs = 10000,
    agora = () => Date.now(),
  } = {}) {
    this.limiteErro = limiteErro;
    this.volumeMinimo = volumeMinimo;
    this.janela = janela;
    this.cooldownMs = cooldownMs;
    this.agora = agora;
    this.estado = ESTADOS.FECHADO;
    this.eventos = []; // true = falha, false = sucesso (apenas os últimos `janela`)
    this.abertoDesde = 0;
  }

  get falhas() {
    return this.eventos.filter(Boolean).length;
  }

  get sucessos() {
    return this.eventos.length - this.falhas;
  }

  get total() {
    return this.eventos.length;
  }

  get taxaErro() {
    if (this.total === 0) {
      return 0;
    }
    return this.falhas / this.total;
  }

  aberto() {
    return this.estado === ESTADOS.ABERTO;
  }

  /**
   * Decide se uma requisição pode prosseguir. Se o breaker está ABERTO e o
   * cooldown já passou, transita para MEIO_ABERTO e libera UMA sondagem.
   */
  permiteRequisicao() {
    if (this.estado !== ESTADOS.ABERTO) {
      return true;
    }
    if (this.agora() - this.abertoDesde >= this.cooldownMs) {
      this.estado = ESTADOS.MEIO_ABERTO;
      return true;
    }
    return false;
  }

  registrarSucesso() {
    if (this.estado === ESTADOS.MEIO_ABERTO) {
      this.#fechar();
      return;
    }
    this.#registrar(false);
  }

  registrarFalha() {
    if (this.estado === ESTADOS.MEIO_ABERTO) {
      this.#abrir();
      return;
    }
    this.#registrar(true);
    if (this.total >= this.volumeMinimo && this.taxaErro > this.limiteErro) {
      this.#abrir();
    }
  }

  #registrar(falhou) {
    this.eventos.push(falhou);
    if (this.eventos.length > this.janela) {
      this.eventos.shift();
    }
  }

  #abrir() {
    this.estado = ESTADOS.ABERTO;
    this.abertoDesde = this.agora();
  }

  #fechar() {
    this.estado = ESTADOS.FECHADO;
    this.eventos = [];
    this.abertoDesde = 0;
  }
}

module.exports = { CircuitBreaker, ESTADOS };

'use strict';

/**
 * Erro lançado quando uma operação ultrapassa o tempo-limite (RN04).
 * Marcado como erro de infraestrutura para ser elegível a retentativa.
 */
class TimeoutError extends Error {
  constructor(ms) {
    super(`Operação excedeu o timeout de ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEDOUT';
  }
}

/**
 * Relógio real do sistema. É injetado no serviço para que os testes possam
 * substituí-lo por um relógio falso e ficarem determinísticos (sem esperas
 * reais e com asserção sobre os tempos usados).
 */
const relogioReal = {
  /** Instante atual em ms (injetável para o cooldown do circuit breaker). */
  agora() {
    return Date.now();
  },

  /** Aguarda `ms` milissegundos. Usado pelo backoff (RN06). */
  aguardar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Aplica um timeout a uma promessa (RN04). Rejeita com TimeoutError se a
   * promessa não resolver dentro de `ms`. Limpa o timer em qualquer desfecho.
   */
  comTimeout(promessa, ms) {
    let timer;
    const expiracao = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    });
    return Promise.race([promessa, expiracao]).finally(() => clearTimeout(timer));
  },
};

module.exports = { TimeoutError, relogioReal };

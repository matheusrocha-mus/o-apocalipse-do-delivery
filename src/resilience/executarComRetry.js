'use strict';

/**
 * Política de retentativas com backoff e jitter (RN05/RN06 + Fase 4/SRE).
 *
 * Executa `operacao` até `maxTentativas` vezes. Entre tentativas que falharem
 * com erro retentável, aguarda `backoffMs` mais um jitter aleatório em
 * `[0, jitterMs)`, usando a função `aguardar` injetada. O jitter desincroniza
 * retentativas concorrentes (anti-Thundering Herd); com `jitterMs = 0` recai no
 * backoff fixo da RN06. Erros não-retentáveis abortam imediatamente.
 *
 * @param {() => Promise<any>} operacao   Operação assíncrona a ser executada.
 * @param {object} opts
 * @param {number} opts.maxTentativas     Total de tentativas (inicial + retries).
 * @param {number} opts.backoffMs         Espera-base entre tentativas.
 * @param {number} [opts.jitterMs=0]      Amplitude do jitter aleatório.
 * @param {(ms:number)=>Promise<void>} opts.aguardar  Função de espera (injetável).
 * @param {(erro:Error)=>boolean} opts.ehRetentavel   Classificador de erro.
 * @param {()=>number} [opts.aleatorio]   Fonte de aleatoriedade (injetável).
 */
async function executarComRetry(
  operacao,
  { maxTentativas, backoffMs, jitterMs = 0, aguardar, ehRetentavel, aleatorio = Math.random },
) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;

      const ehUltima = tentativa === maxTentativas;
      if (ehUltima || !ehRetentavel(erro)) {
        throw erro;
      }

      const espera = backoffMs + Math.floor(aleatorio() * jitterMs);
      await aguardar(espera);
    }
  }

  throw ultimoErro;
}

module.exports = { executarComRetry };

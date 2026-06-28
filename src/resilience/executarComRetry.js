'use strict';

/**
 * Política de retentativas com backoff fixo (RN05/RN06).
 *
 * Executa `operacao` até `maxTentativas` vezes. Entre tentativas que falharem
 * com erro retentável, aguarda `backoffMs` usando a função `aguardar` injetada.
 * Erros não-retentáveis (ex.: falha de programação) abortam imediatamente.
 *
 * @param {() => Promise<any>} operacao   Operação assíncrona a ser executada.
 * @param {object} opts
 * @param {number} opts.maxTentativas     Total de tentativas (inicial + retries).
 * @param {number} opts.backoffMs         Espera fixa entre tentativas.
 * @param {(ms:number)=>Promise<void>} opts.aguardar  Função de espera (injetável).
 * @param {(erro:Error)=>boolean} opts.ehRetentavel    Classificador de erro.
 */
async function executarComRetry(operacao, { maxTentativas, backoffMs, aguardar, ehRetentavel }) {
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

      await aguardar(backoffMs);
    }
  }

  throw ultimoErro;
}

module.exports = { executarComRetry };

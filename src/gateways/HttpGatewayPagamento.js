'use strict';

/**
 * Adapter HTTP para o Gateway de Pagamento externo.
 *
 * Faz a chamada de rede REAL (via `fetch` nativo do Node 22) para a URL do
 * gateway — que, no ambiente de caos, aponta para o listener do Toxiproxy. Os
 * erros são normalizados para o formato que a política de resiliência entende:
 *  - HTTP 5xx  -> erro com `.status` (retentável, RN05)
 *  - conexão recusada/abortada -> erro com `.code` de rede (retentável)
 *
 * O timeout em si é responsabilidade do CheckoutService (RN04), que envolve esta
 * chamada com `relogio.comTimeout`.
 */
class HttpGatewayPagamento {
  constructor(baseUrl, fetchImpl = globalThis.fetch) {
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
  }

  async cobrar(valor, cartao) {
    let resposta;
    try {
      resposta = await this.fetch(`${this.baseUrl}/cobrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor, cartao }),
      });
    } catch (causa) {
      const erro = new Error(`Falha de rede ao contatar o gateway: ${causa.message}`);
      erro.code = causa.code || 'ECONNREFUSED';
      throw erro;
    }

    if (resposta.status >= 500) {
      const erro = new Error(`Gateway respondeu ${resposta.status}`);
      erro.status = resposta.status;
      throw erro;
    }

    return resposta.json();
  }
}

module.exports = { HttpGatewayPagamento };

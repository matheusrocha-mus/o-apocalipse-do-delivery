'use strict';

const { criarConfigResiliencia } = require('../config/resiliencia');
const { relogioReal } = require('../resilience/clock');
const { CircuitBreaker } = require('../resilience/CircuitBreaker');
const { executarComRetry } = require('../resilience/executarComRetry');
const { ehErroDeInfra } = require('../resilience/errosInfra');
const { resolverDesfecho } = require('./desfechosNegocio');

const STATUS = Object.freeze({
  PROCESSADO: 'PROCESSADO',
  FALHOU: 'FALHOU',
  ERRO_GATEWAY: 'ERRO_GATEWAY',
});

/**
 * Serviço de checkout resiliente (RF02–RF05).
 *
 * Dependências são injetadas via construtor (Dependency Injection), o que
 * elimina o Obscure Setup nos testes e permite usar Stubs (estado) e Mocks
 * (comportamento). O relógio e o circuit breaker também são injetáveis, deixando
 * os testes determinísticos.
 */
class CheckoutService {
  constructor(gatewayPagamento, pedidoRepository, emailService, opcoes = {}) {
    this.gatewayPagamento = gatewayPagamento;
    this.pedidoRepository = pedidoRepository;
    this.emailService = emailService;
    this.config = criarConfigResiliencia(opcoes.config);
    this.relogio = opcoes.relogio || relogioReal;
    this.circuitBreaker =
      opcoes.circuitBreaker ||
      new CircuitBreaker({
        limiteErro: this.config.limiteErro,
        volumeMinimo: this.config.volumeMinimo,
      });
  }

  /**
   * Processa um pedido. Sempre resolve com o pedido salvo (nunca lança), de modo
   * que o servidor não sofra Uncaught Exceptions (RN07). O status final do pedido
   * informa o controlador qual HTTP devolver.
   */
  async processar(pedido) {
    if (this.circuitBreaker.aberto()) {
      return this.#acionarFallback(pedido);
    }

    let resposta;
    try {
      resposta = await this.#cobrarComResiliencia(pedido);
    } catch (erro) {
      this.circuitBreaker.registrarFalha();
      return this.#acionarFallback(pedido);
    }

    this.circuitBreaker.registrarSucesso();
    return this.#concluirNegocio(pedido, resposta);
  }

  /** Envolve a chamada externa com timeout (RN04) + retry/backoff (RN05/RN06). */
  #cobrarComResiliencia(pedido) {
    return executarComRetry(
      () =>
        this.relogio.comTimeout(
          this.gatewayPagamento.cobrar(pedido.valor, pedido.cartao),
          this.config.timeoutMs,
        ),
      {
        maxTentativas: this.config.maxTentativas,
        backoffMs: this.config.backoffMs,
        aguardar: (ms) => this.relogio.aguardar(ms),
        ehRetentavel: ehErroDeInfra,
      },
    );
  }

  /** Caminho feliz / falha de negócio, resolvido por tabela (sem if/else). */
  async #concluirNegocio(pedido, resposta) {
    const desfecho = resolverDesfecho(resposta.status);
    pedido.status = desfecho.statusPedido;
    const pedidoSalvo = await this.pedidoRepository.salvar(pedido);

    if (desfecho.enviarEmail) {
      this.#notificarAssincrono(pedido.clienteEmail);
    }

    return pedidoSalvo;
  }

  /** Plano de contingência (RN07): grava ERRO_GATEWAY e devolve o pedido salvo. */
  async #acionarFallback(pedido) {
    pedido.status = STATUS.ERRO_GATEWAY;
    return this.pedidoRepository.salvar(pedido);
  }

  /**
   * Dispara o e-mail de confirmação de forma assíncrona (RF02 / non-blocking).
   * A falha no envio é registrada mas jamais propaga para a resposta do cliente.
   */
  #notificarAssincrono(clienteEmail) {
    Promise.resolve()
      .then(() => this.emailService.enviarConfirmacao(clienteEmail, 'Pagamento Aprovado'))
      .catch((erro) => console.error('Falha ao enviar e-mail de confirmação:', erro.message));
  }
}

module.exports = { CheckoutService, STATUS };

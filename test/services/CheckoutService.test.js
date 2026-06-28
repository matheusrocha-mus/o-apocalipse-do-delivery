'use strict';

const { CheckoutService, STATUS } = require('../../src/services/CheckoutService');
const { CircuitBreaker } = require('../../src/resilience/CircuitBreaker');
const { umPedido } = require('../builders/PedidoBuilder');
const {
  gatewayQueResponde,
  gatewayInstavel,
  gatewayForaDoAr,
  repositorioEmMemoria,
  emailMock,
  erroConexao,
  relogioFake,
  drenarPromises,
} = require('../builders/dublesTeste');

function montarServico(gateway, extras = {}) {
  const repositorio = extras.repositorio || repositorioEmMemoria();
  const email = extras.email || emailMock();
  const relogio = extras.relogio || relogioFake();
  const servico = new CheckoutService(gateway, repositorio, email, {
    relogio,
    circuitBreaker: extras.circuitBreaker,
    config: extras.config,
  });
  return { servico, repositorio, email, relogio };
}

describe('CheckoutService', () => {
  describe('Construção com dependências padrão', () => {
    it('usa relógio real e circuit breaker próprios quando nenhum é injetado', async () => {
      const servico = new CheckoutService(
        gatewayQueResponde('APROVADO'),
        repositorioEmMemoria(),
        emailMock(),
      );

      const salvo = await servico.processar(umPedido().build());

      expect(salvo.status).toBe(STATUS.PROCESSADO);
      expect(servico.circuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(servico.config.timeoutMs).toBe(2000);
      // o breaker padrão usa o relógio real do serviço (agora numérico)
      expect(typeof servico.circuitBreaker.agora()).toBe('number');
    });

    it('repassa os limites de config ao circuit breaker criado por padrão', () => {
      const servico = new CheckoutService(
        gatewayQueResponde('APROVADO'),
        repositorioEmMemoria(),
        emailMock(),
        { config: { limiteErro: 0.9, volumeMinimo: 7 } },
      );

      expect(servico.circuitBreaker.limiteErro).toBe(0.9);
      expect(servico.circuitBreaker.volumeMinimo).toBe(7);
    });
  });

  describe('Fluxo 1 — pagamento aprovado (caminho feliz)', () => {
    it('marca o pedido como PROCESSADO e persiste', async () => {
      const { servico, repositorio } = montarServico(gatewayQueResponde('APROVADO'));

      const salvo = await servico.processar(umPedido().build());

      expect(salvo.status).toBe(STATUS.PROCESSADO);
      expect(repositorio.salvar).toHaveBeenCalledTimes(1);
    });

    it('dispara o e-mail de confirmação de forma assíncrona (Mock de comportamento)', async () => {
      const { servico, email } = montarServico(gatewayQueResponde('APROVADO'));
      const pedido = umPedido().comEmail('ana@entregaja.com').build();

      await servico.processar(pedido);
      await drenarPromises();

      expect(email.enviarConfirmacao).toHaveBeenCalledTimes(1);
      expect(email.enviarConfirmacao).toHaveBeenCalledWith('ana@entregaja.com', 'Pagamento Aprovado');
    });

    it('não bloqueia a resposta e registra log quando o envio do e-mail falha', async () => {
      const erroSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const email = emailMock();
      email.enviarConfirmacao.mockRejectedValue(new Error('SMTP fora do ar'));
      const { servico } = montarServico(gatewayQueResponde('APROVADO'), { email });

      const salvo = await servico.processar(umPedido().build());
      await drenarPromises();

      expect(salvo.status).toBe(STATUS.PROCESSADO);
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falha ao enviar e-mail'),
        'SMTP fora do ar',
      );
      erroSpy.mockRestore();
    });
  });

  describe('Fluxo 2 — pagamento recusado (falha de negócio)', () => {
    it('marca o pedido como FALHOU e NÃO envia e-mail', async () => {
      const { servico, repositorio, email } = montarServico(gatewayQueResponde('RECUSADO'));

      const salvo = await servico.processar(umPedido().build());
      await drenarPromises();

      expect(salvo.status).toBe(STATUS.FALHOU);
      expect(repositorio.salvar).toHaveBeenCalledTimes(1);
      expect(email.enviarConfirmacao).not.toHaveBeenCalled();
    });

    it.each(['RECUSADO', 'SALDO_INSUFICIENTE', 'CARTAO_EXPIRADO', 'STATUS_DESCONHECIDO'])(
      'trata o status "%s" como falha de negócio sem e-mail',
      async (status) => {
        const { servico, email } = montarServico(gatewayQueResponde(status));

        const salvo = await servico.processar(umPedido().build());
        await drenarPromises();

        expect(salvo.status).toBe(STATUS.FALHOU);
        expect(email.enviarConfirmacao).not.toHaveBeenCalled();
      },
    );
  });

  describe('Fluxo 3 — resiliência (recupera após retentativa)', () => {
    it('executa 1 retry, recupera-se e conclui como PROCESSADO', async () => {
      const gateway = gatewayInstavel(1, 'APROVADO', erroConexao());
      const { servico, email, relogio } = montarServico(gateway);

      const salvo = await servico.processar(umPedido().build());
      await drenarPromises();

      expect(gateway.cobrar).toHaveBeenCalledTimes(2);
      expect(salvo.status).toBe(STATUS.PROCESSADO);
      expect(email.enviarConfirmacao).toHaveBeenCalledTimes(1);
      expect(relogio.aguardar).toHaveBeenCalledWith(500);
    });
  });

  describe('Fluxo 4 — caos total (esgota retentativas)', () => {
    it('tenta 4 vezes, aciona fallback e marca ERRO_GATEWAY', async () => {
      const gateway = gatewayForaDoAr(erroConexao());
      const { servico, repositorio, email } = montarServico(gateway);

      const salvo = await servico.processar(umPedido().build());

      expect(gateway.cobrar).toHaveBeenCalledTimes(4);
      expect(salvo.status).toBe('ERRO_GATEWAY'); // literal: ancora o valor da constante STATUS
      expect(repositorio.salvar).toHaveBeenCalledTimes(1);
      expect(email.enviarConfirmacao).not.toHaveBeenCalled();
    });

    it('aguarda o backoff entre cada retentativa (3 esperas para 4 tentativas)', async () => {
      const { servico, relogio } = montarServico(gatewayForaDoAr(erroConexao()));

      await servico.processar(umPedido().build());

      expect(relogio.aguardar).toHaveBeenCalledTimes(3);
    });

    it('não lança exceção mesmo na queda total do gateway (sem Uncaught Exception)', async () => {
      const { servico } = montarServico(gatewayForaDoAr(erroConexao()));

      await expect(servico.processar(umPedido().build())).resolves.toBeDefined();
    });
  });

  describe('Circuit Breaker (RN07)', () => {
    it('quando aberto, vai direto ao fallback sem chamar o gateway', async () => {
      const breaker = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 1 });
      breaker.registrarFalha(); // taxa de erro 100% > 50% => aberto
      const gateway = gatewayQueResponde('APROVADO');
      const { servico } = montarServico(gateway, { circuitBreaker: breaker });

      const salvo = await servico.processar(umPedido().build());

      expect(salvo.status).toBe(STATUS.ERRO_GATEWAY);
      expect(gateway.cobrar).not.toHaveBeenCalled();
    });

    it('registra sucesso de rede mesmo quando o pagamento é recusado', async () => {
      const breaker = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
      const { servico } = montarServico(gatewayQueResponde('RECUSADO'), { circuitBreaker: breaker });

      await servico.processar(umPedido().build());

      expect(breaker.sucessos).toBe(1);
      expect(breaker.falhas).toBe(0);
    });

    it('registra falha de rede quando a infraestrutura cai', async () => {
      const breaker = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
      const { servico } = montarServico(gatewayForaDoAr(erroConexao()), { circuitBreaker: breaker });

      await servico.processar(umPedido().build());

      expect(breaker.falhas).toBe(1);
      expect(breaker.sucessos).toBe(0);
    });
  });
});

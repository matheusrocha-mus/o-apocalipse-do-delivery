'use strict';

const express = require('express');
const { CheckoutService, STATUS } = require('./services/CheckoutService');
const { validarPayloadCheckout } = require('./http/validacaoCheckout');
const { HttpGatewayPagamento } = require('./gateways/HttpGatewayPagamento');
const { criarConfigResiliencia } = require('./config/resiliencia');

const app = express();
app.use(express.json());

// --- Seleção do gateway -----------------------------------------------------
// Por padrão usa um mock em processo (300ms). No ambiente de caos, defina
// GATEWAY_URL apontando para o listener do Toxiproxy: as chamadas viram rede
// real e podem ser "envenenadas" (latência/queda).
const gatewayPagamento = process.env.GATEWAY_URL
  ? new HttpGatewayPagamento(process.env.GATEWAY_URL)
  : {
      cobrar: async () =>
        new Promise((resolve) => setTimeout(() => resolve({ status: 'APROVADO' }), 300)),
    };

const pedidoRepositoryMock = {
  salvar: async (pedido) => ({ ...pedido, id: Math.floor(Math.random() * 10000) }),
};

const emailServiceMock = {
  enviarConfirmacao: async (email) => console.log(`E-mail enviado para ${email}`),
};

// Jitter e cooldown ajustáveis por env no ambiente de caos (Thundering Herd / MTTR).
const config = criarConfigResiliencia({
  jitterMs: Number(process.env.JITTER_MS || 0),
  ...(process.env.COOLDOWN_MS ? { cooldownMs: Number(process.env.COOLDOWN_MS) } : {}),
});

const checkoutService = new CheckoutService(
  gatewayPagamento,
  pedidoRepositoryMock,
  emailServiceMock,
  { config },
);

// ENDPOINT CRÍTICO: rota que receberá a carga massiva da Black Friday.
app.post('/api/v1/checkout', async (req, res) => {
  // RF01 / Fluxo 5: valida o contrato antes de tocar banco ou gateway.
  const { valido, erros } = validarPayloadCheckout(req.body);
  if (!valido) {
    return res.status(400).json({ erro: 'Dados incompletos para checkout', detalhes: erros });
  }

  const { clienteEmail, valor, cartao } = req.body;
  const pedido = { clienteEmail, valor, cartao, status: 'PENDENTE' };

  const resultado = await checkoutService.processar(pedido);

  // O status final do pedido decide o HTTP (RF02/RF03/RF05).
  if (resultado.status === STATUS.PROCESSADO) {
    return res.status(200).json({ mensagem: 'Pedido finalizado com sucesso!', pedido: resultado });
  }

  return res
    .status(500)
    .json({ erro: 'Não foi possível processar seu pagamento. Tente mais tarde.', pedido: resultado });
});

// Observabilidade: estado do circuit breaker (usado para medir o MTTR no caos).
app.get('/api/v1/health', (_req, res) => {
  const cb = checkoutService.circuitBreaker;
  res.json({
    estado: cb.estado,
    taxaErro: Number(cb.taxaErro.toFixed(3)),
    sucessos: cb.sucessos,
    falhas: cb.falhas,
  });
});

// Endpoint auxiliar para o cenário de Thundering Herd (Fase 4).
app.post('/api/v1/cache/flush', (req, res) => {
  console.log('💥 CACHE LIMPO ABRUPTAMENTE!');
  res.json({ status: 'cache_invalidated' });
});

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Servidor da EntregasJá rodando na porta ${PORT}`));
}

module.exports = { app };

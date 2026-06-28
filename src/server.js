'use strict';

const express = require('express');
const { CheckoutService, STATUS } = require('./services/CheckoutService');
const { validarPayloadCheckout } = require('./http/validacaoCheckout');

const app = express();
app.use(express.json());

// Mocks de infraestrutura para o servidor rodar localmente antes do Toxiproxy (Fase 4).
const gatewayPagamentoMock = {
  cobrar: async () =>
    new Promise((resolve) => setTimeout(() => resolve({ status: 'APROVADO' }), 300)),
};

const pedidoRepositoryMock = {
  salvar: async (pedido) => ({ ...pedido, id: Math.floor(Math.random() * 10000) }),
};

const emailServiceMock = {
  enviarConfirmacao: async (email) => console.log(`E-mail enviado para ${email}`),
};

const checkoutService = new CheckoutService(
  gatewayPagamentoMock,
  pedidoRepositoryMock,
  emailServiceMock,
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

// Endpoint auxiliar para o cenário de Thundering Herd (Fase 4).
app.post('/api/v1/cache/flush', (req, res) => {
  console.log('💥 CACHE LIMPO ABRUPTAMENTE!');
  res.json({ status: 'cache_invalidated' });
});

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Servidor da EntregasJá rodando na porta ${PORT}`));
}

module.exports = { app };

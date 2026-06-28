'use strict';

/**
 * Simulador do Gateway de Pagamento externo (API de terceiros).
 *
 * É um processo HTTP separado para que o Toxiproxy possa interceptar a chamada
 * de rede entre o CheckoutService e o gateway, injetando latência/queda. Sem uma
 * fronteira de rede real, não haveria o que o Toxiproxy "envenenar".
 *
 * Responde POST /cobrar com { status: 'APROVADO' } após ~LATENCIA_MS (padrão
 * 300 ms, como o mock original do server.js).
 */
const express = require('express');

const PORT = Number(process.env.GATEWAY_PORT || 9090);
const LATENCIA_MS = Number(process.env.GATEWAY_LATENCIA_MS || 300);

const app = express();
app.use(express.json());

app.post('/cobrar', (req, res) => {
  setTimeout(() => res.status(200).json({ status: 'APROVADO' }), LATENCIA_MS);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () =>
  console.log(`💳 Gateway simulado ouvindo em http://localhost:${PORT} (latência base ${LATENCIA_MS}ms)`),
);

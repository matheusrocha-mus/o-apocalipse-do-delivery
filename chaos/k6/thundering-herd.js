import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * Thundering Herd (Manada Estourada) — Fase 4.
 *
 * Dispara um flush abrupto do cache e, em seguida, um pico de requisições
 * simultâneas para avaliar se o sistema sobrevive (graças a timeout + retry com
 * jitter + circuit breaker). O `constant-arrival-rate` mantém a taxa de chegada
 * independentemente da latência das respostas — é assim que se modela uma manada.
 *
 * Parametrizável:
 *   BASE_URL    (padrão http://localhost:3000)
 *   TAXA        (padrão 500 req/s)  — suba para se aproximar das 10.000 simultâneas
 *   DURACAO     (padrão 30s)
 *   PRE_VUS     (padrão 200)        — VUs pré-alocados para sustentar a taxa
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TAXA = Number(__ENV.TAXA || 500);
const DURACAO = __ENV.DURACAO || '30s';
const PRE_VUS = Number(__ENV.PRE_VUS || 200);

const servidorVivo = new Rate('servidor_respondeu');

export const options = {
  scenarios: {
    manada: {
      executor: 'constant-arrival-rate',
      rate: TAXA,
      timeUnit: '1s',
      duration: DURACAO,
      preAllocatedVUs: PRE_VUS,
      maxVUs: PRE_VUS * 10,
    },
  },
  thresholds: {
    // Sob a manada, latência/erro PODEM degradar; o que não pode é o servidor cair.
    servidor_respondeu: ['rate>0.99'],
  },
};

const payload = JSON.stringify({
  clienteEmail: 'cliente@entregaja.com',
  valor: 100.0,
  cartao: { numero: '4111111111111111', validade: '12/30', cvv: '123' },
});
const params = { headers: { 'Content-Type': 'application/json' } };

export function setup() {
  // Flush abrupto do cache imediatamente antes da manada.
  http.post(`${BASE_URL}/api/v1/cache/flush`);
}

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/checkout`, payload, params);
  servidorVivo.add(res.status !== 0);
  check(res, {
    'servidor respondeu (não colapsou)': (r) => r.status !== 0,
  });
}

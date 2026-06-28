import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Teste de Carga e Estresse — volumetria de Black Friday (RF não-funcionais §5).
 * Padrão ramp-up → steady → ramp-down.
 *
 * Parametrizável por ambiente:
 *   BASE_URL  (padrão http://localhost:3000)
 *   VUS_PICO  (padrão 50)   — VUs no platô (suba para simular a Black Friday real)
 *
 * SLO (thresholds que reprovam a execução se violados):
 *   - p95 da latência das requisições bem-sucedidas < 2500ms (spec §5)
 *   - taxa de erro de ponta a ponta < 5% (spec §5)
 *   - o servidor NUNCA pode colapsar (toda requisição recebe resposta HTTP)
 */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VUS_PICO = Number(__ENV.VUS_PICO || 50);

const erroNegocio = new Rate('erros_5xx_graciosos');
const servidorVivo = new Rate('servidor_respondeu');
const latenciaSucesso = new Trend('latencia_sucesso_ms', true);

export const options = {
  scenarios: {
    black_friday: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '20s', target: VUS_PICO }, // ramp-up
        { duration: __ENV.STEADY || '40s', target: VUS_PICO },  // steady (platô)
        { duration: __ENV.RAMP_DOWN || '10s', target: 0 },      // ramp-down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    'http_req_duration{status:200}': ['p(95)<2500'],
    http_req_failed: ['rate<0.05'],
    servidor_respondeu: ['rate>0.99'],
  },
};

const payload = JSON.stringify({
  clienteEmail: 'cliente@entregaja.com',
  valor: 100.0,
  cartao: { numero: '4111111111111111', validade: '12/30', cvv: '123' },
});
const params = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/checkout`, payload, params);

  // O servidor está vivo se devolveu QUALQUER HTTP (status != 0). status 0 = colapso.
  servidorVivo.add(res.status !== 0);
  erroNegocio.add(res.status >= 500 && res.status !== 0);
  if (res.status === 200) {
    latenciaSucesso.add(res.timings.duration);
  }

  check(res, {
    'respondeu (sem colapso)': (r) => r.status !== 0,
    'status 200 ou 500 (degradação controlada)': (r) => r.status === 200 || r.status === 500,
  });
}

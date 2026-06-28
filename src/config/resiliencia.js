'use strict';

/**
 * Introduce Parameter Object (Fowler): agrupa os parâmetros de tolerância a
 * falhas num único objeto de configuração, em vez de espalhar números mágicos
 * (2000, 500, 3, 0.5) pelo código do serviço.
 *
 * Valores-padrão derivados diretamente da especificação (RF04/RF05):
 *  - timeoutMs ......... RN04: timeout rígido de 2000 ms na chamada `cobrar`.
 *  - maxTentativas ..... RN05: 1 tentativa inicial + 3 retentativas = 4 no total.
 *  - backoffMs ......... RN06: intervalo fixo de 500 ms entre as tentativas.
 *  - jitterMs .......... Fase 4 (SRE): jitter aleatório somado ao backoff para
 *                        evitar retentativas sincronizadas (Thundering Herd).
 *                        Padrão 0 = comportamento fixo da RN06.
 *  - limiteErro ........ RN07: circuit breaker abre com taxa de erro de rede > 50%.
 *  - volumeMinimo ...... nº mínimo de chamadas antes de o breaker poder abrir.
 *  - cooldownMs ........ Fase 4 (SRE): tempo que o breaker permanece ABERTO antes
 *                        de liberar uma sondagem (MEIO_ABERTO) — habilita o MTTR.
 */
const CONFIG_PADRAO = Object.freeze({
  timeoutMs: 2000,
  maxTentativas: 4,
  backoffMs: 500,
  jitterMs: 0,
  limiteErro: 0.5,
  volumeMinimo: 4,
  cooldownMs: 10000,
});

function criarConfigResiliencia(overrides = {}) {
  return { ...CONFIG_PADRAO, ...overrides };
}

module.exports = { CONFIG_PADRAO, criarConfigResiliencia };

# Engenharia do Caos e Testes de Desempenho (SRE)

**Ferramentas:** k6 v2.0 (carga) · Toxiproxy v2.12 (injeção de falhas) — binários nativos em `tools/` (sem Docker/WSL2).
**Meta:** provar que a arquitetura sobrevive ao caos com **degradação graciosa** e
medir o **MTTR**.

---

## 1. Arquitetura do experimento

Para o Toxiproxy poder "envenenar" a chamada ao gateway, ela precisa ser uma chamada de **rede real**. Por isso o gateway in-process foi substituído, no ambiente de caos, por um simulador HTTP separado, com o Toxiproxy no meio:

```
  k6  ──HTTP──▶  App (3000)  ──HTTP──▶  Toxiproxy (21090)  ──▶  Gateway simulado (9090)
 carga          CheckoutService          injeta latência/queda      responde em ~300ms
                (timeout/retry/CB)
```

- App: [`src/server.js`](../src/server.js) usa [`HttpGatewayPagamento`](../src/gateways/HttpGatewayPagamento.js) quando `GATEWAY_URL` está setado.
- Gateway simulado: [`chaos/gateway-sim/server.js`](../chaos/gateway-sim/server.js).
- Proxy: [`chaos/toxiproxy/proxies.json`](../chaos/toxiproxy/proxies.json) (listen 21090 → upstream 9090).

---

## 2. Como executar (runbook)

```powershell
# 1. Sobe Toxiproxy + gateway simulado + proxy + app
pwsh chaos/scripts/iniciar-ambiente.ps1

# 2. (terminal A) carga k6 — escolha o cenário
tools\k6.exe run chaos/k6/load-test.js          # ramp-up/steady/ramp-down
tools\k6.exe run chaos/k6/thundering-herd.js     # manada estourada

# 3. (terminal B) injeta o caos no meio da carga
pwsh chaos/scripts/injetar-caos.ps1 gateway-lento   # +5000ms (RN04)
pwsh chaos/scripts/injetar-caos.ps1 gateway-down     # queda total
pwsh chaos/scripts/injetar-caos.ps1 limpar           # remove o caos (recuperação)

# 4. Experimento de MTTR automatizado (injeta, mede abertura e recuperação)
bash chaos/scripts/experimento-mttr.sh

# 5. Encerra tudo
pwsh chaos/scripts/parar-ambiente.ps1
```

Para a Black Friday "de verdade", suba a carga: `VUS_PICO=500 tools\k6.exe run chaos/k6/load-test.js` ou `TAXA=2000 tools\k6.exe run chaos/k6/thundering-herd.js`.

---

## 3. Definição de SLI/SLO (thresholds k6)

| SLI                                               | SLO (threshold)                | Onde                              |
| :------------------------------------------------ | :----------------------------- | :-------------------------------- |
| Latência p95 das requisições bem-sucedidas     | **< 2500 ms** (spec §5) | `http_req_duration{status:200}` |
| Taxa de erro de ponta a ponta                     | **< 5%** (spec §5)      | `http_req_failed: rate<0.05`    |
| Disponibilidade (servidor responde, não colapsa) | **> 99%**                | `servidor_respondeu: rate>0.99` |

> A spec da EntregasJá (§5) é mais rígida que o corpo do PDF (p95 < 5 s): adotamos o p95 < 2500 ms como SLO formal.

---

## 4. Resultados medidos

Gráficos completos (relatórios HTML do dashboard do k6, versionados):
- Baseline: [`docs/relatorios/k6/baseline.html`](relatorios/k6/baseline.html)
- Gateway Lento: [`docs/relatorios/k6/gateway-lento.html`](relatorios/k6/gateway-lento.html)
- Thundering Herd: [`docs/relatorios/k6/thundering-herd.html`](relatorios/k6/thundering-herd.html)

### 4.1. Baseline (sem caos) — `load-test.js`, 30 VUs

| Métrica                       | Resultado           | SLO       | Status |
| :----------------------------- | :------------------ | :-------- | :----- |
| `http_req_duration{200}` p95 | **331,28 ms** | < 2500 ms | ✅     |
| `http_req_failed`            | **0,00%**     | < 5%      | ✅     |
| `servidor_respondeu`         | **100,00%**   | > 99%     | ✅     |
| Iterações                    | 2.595 (≈ 74 req/s) | —        | —     |

### 4.2. Sob caos "Gateway Lento" (+5000 ms) — `load-test.js`, 30 VUs, 30 s

| Métrica               | Resultado                      | Interpretação                                                 |
| :--------------------- | :----------------------------- | :-------------------------------------------------------------- |
| `http_req_failed`    | **100%**                 | SLO de erro **violado de propósito** — gateway inviável |
| `servidor_respondeu` | **100%** (89.687/89.687) | **servidor NUNCA colapsou**                               |
| Vazão                 | **≈ 2.989 req/s**        | absorveu a carga mesmo em falha                                 |
| Latência mediana      | **3,66 ms**              | *fast-fail* após o breaker abrir                             |
| Latência máx         | **10,2 s**               | requisições da janela de detecção (antes do CB abrir)       |

**Leitura:** sem proteção, 5 s de latência × carga esgotaria o pool de threads do Express e derrubaria o processo (colapso). Com timeout (2 s) + retry + circuit breaker, o sistema passa a **falhar rápido (~poucos ms)** e continua de pé a ~2.989 req/s. Essa é a **degradação graciosa**.

### 4.2.1. Thundering Herd — `thundering-herd.js`, 800 req/s, 20 s

Flush abrupto do cache seguido de pico de chegada constante. Resultado: **15.809
requisições, `servidor_respondeu` 100%, `http_req_failed` 0%**, p95 564 ms — o
banco simulado sobrevive à manada graças ao backoff+jitter e ao circuit breaker.
(Suba `TAXA` para se aproximar das 10.000 simultâneas do enunciado.)

### 4.3. Ciclo completo de incidente e MTTR — `experimento-mttr.sh`

(app com `COOLDOWN_MS=3000` para um MTTR demonstrável)

| Fase                            | Evento                                                 | Tempo medido               |
| :------------------------------ | :----------------------------------------------------- | :------------------------- |
| **Detecção/Proteção** | da injeção do tóxico até o CB**ABRIR**       | **10.411 ms**        |
| **Degradação graciosa** | checkouts com CB aberto (*fast-fail*)                | **~2 ms** (HTTP 500) |
| **MTTR (recuperação)**  | de remover a falha até o CB voltar a**FECHADO** | **2.724 ms**         |

**Cálculo do MTTR.** Definimos MTTR como o tempo entre a *resolução* da falha (remoção do tóxico, `t_remove`) e o *restabelecimento* do serviço (circuit breaker de volta a `FECHADO` após uma sondagem half-open bem-sucedida, `t_closed`):

```
MTTR = t_closed − t_remove = 2.724 ms  ≈  cooldown (3.000 ms) + 1 sondagem
```

O tempo de **detecção** (~10,4 s) é dominado pela cadeia de resiliência por requisição: 4 tentativas × 2 s de timeout + 3 × (500 ms backoff + jitter) ≈ 9,8 s, até acumular falhas suficientes na janela do breaker para ultrapassar 50%.

---

## 5. Mecanismos de resiliência que sustentam o resultado

| Mecanismo                                                | Implementação                     | Papel no caos                                                                |
| :------------------------------------------------------- | :---------------------------------- | :--------------------------------------------------------------------------- |
| **Timeout 2 s** (RN04)                             | `clock.comTimeout`                | impede que a latência de 5 s prenda o thread                                |
| **Retry 3× + backoff 500 ms** (RN05/RN06)         | `executarComRetry`                | recupera de instabilidades transitórias                                     |
| **Jitter** (Fase 4)                                | `executarComRetry` (`jitterMs`) | desincroniza retentativas no Thundering Herd                                 |
| **Circuit Breaker (janela deslizante, half-open)** | `CircuitBreaker`                  | abre em falha sustentada (*fast-fail*) e **recupera sozinho** (MTTR) |
| **Fallback limpo** (RN07)                          | `CheckoutService#acionarFallback` | responde 500 amigável, sem*Uncaught Exception*                            |

> **Thundering Herd:** `thundering-herd.js` dá um `flush` no cache e dispara um pico com `constant-arrival-rate` (taxa fixa independente da latência). O jitter no backoff evita que as retentativas batam no banco em sincronia; o circuit breaker corta o tráfego ao upstream doente. O SLI a defender aqui é a **sobrevivência do servidor** (`servidor_respondeu`), não a latência.

---

## 6. Conclusão

Sob injeção de caos realista (Toxiproxy) e carga (k6), o `CheckoutService` redesenhado **degrada graciosamente** em vez de colapsar: mantém o servidor de pé a

> 1.300 req/s mesmo com o gateway 100% indisponível, falha rápido para preservar recursos e **se recupera automaticamente** em **~2,7 s (MTTR)** assim que a dependência volta — sem intervenção manual.

# O Apocalipse do Delivery

**Integrantes**

* Gustavo Delfino Guimarães
* Julia Medeiros Silva
* Matheus Caetano Rocha
* Thiago Borges Laass

## Como rodar

```bash
npm install
npm test            # testes unitários/integração (Jest) + cobertura
npm run test:bdd    # especificação viva (Cucumber/Gherkin)
npm run test:mutation   # teste de mutação (Stryker)
npm start           # sobe o servidor em http://localhost:3000
```

Ferramentas de caos (k6 + Toxiproxy) são binários nativos baixados sob demanda:
`powershell -ExecutionPolicy Bypass -File chaos/scripts/baixar-binarios.ps1`.

## Mapa de artefatos por fase

| Fase                                | Artefato                                                    | Onde                                                                                                                                                        |
| :---------------------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Análise & Métricas** | Grafo de fluxo, V(G)=3 e estimativa (APF, horas/homem)      | [docs/analise-estrutural-e-metricas.md](docs/analise-estrutural-e-metricas.md)                                                                                 |
| **2 — TDD/BDD/Patterns**     | Redesenho, Data Builder, Stubs/Mocks, refatorações Fowler | [docs/redesign-tdd-bdd-patterns.md](docs/redesign-tdd-bdd-patterns.md)                                                                                         |
| **2 — BDD**                  | Especificação viva (6 cenários)                          | [features/checkout.feature](features/checkout.feature)                                                                                                         |
| **3 — Mutação**            | Análise (score**99,63%**) e mutante equivalente      | [docs/teste-de-mutacao.md](docs/teste-de-mutacao.md)                                                                                                           |
| **3 — Relatório**           | Relatório HTML do Stryker                                  | [docs/relatorios/mutation/index.html](docs/relatorios/mutation/index.html)                                                                                     |
| **4 — Caos & SRE**           | Runbook, SLO, degradação graciosa e MTTR                  | [docs/caos-e-performance.md](docs/caos-e-performance.md)                                                                                                       |
| **4 — Gráficos k6**         | Dashboards de desempenho                                    | [baseline](docs/relatorios/k6/baseline.html) · [gateway-lento](docs/relatorios/k6/gateway-lento.html) · [thundering-herd](docs/relatorios/k6/thundering-herd.html) |

> Especificação de requisitos do sistema: [docs/especificacao.md](docs/especificacao.md).

## Como (re)gerar os relatórios

```bash
# Relatório de mutação -> docs/relatorios/mutation/index.html
npm run test:mutation

# Gráficos k6 (com o ambiente de caos no ar)
powershell -ExecutionPolicy Bypass -File chaos/scripts/iniciar-ambiente.ps1
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/relatorios/k6/baseline.html tools/k6.exe run chaos/k6/load-test.js
powershell -ExecutionPolicy Bypass -File chaos/scripts/injetar-caos.ps1 gateway-lento   # injeta 5000ms durante a carga
powershell -ExecutionPolicy Bypass -File chaos/scripts/parar-ambiente.ps1
```

Experimento automatizado de MTTR (injeta o caos, mede abertura do breaker e recuperação): `bash chaos/scripts/experimento-mttr.sh`.

## Estrutura

```
src/            código de produção (resiliência, serviço, validação, gateway HTTP)
test/           suíte Jest (builders, stubs/mocks, specs por módulo)
features/       BDD (Gherkin + steps + world)
chaos/          gateway simulado, scripts k6, setup Toxiproxy e runbook
docs/           documentos das 4 fases + relatórios (mutação e k6)
```

## Resultados (resumo)

- **57 → 93 testes** Jest verdes · **6 cenários** BDD · cobertura 100% de branches
- **Mutation Score 99,63%** (1 mutante equivalente justificado)
- Sob gateway 100% indisponível: servidor **não colapsa** (≈3.000 req/s, *fast-fail*) e **recupera em ≈2,7 s (MTTR)**

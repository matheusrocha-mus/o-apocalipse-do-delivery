# Redesenho com TDD, BDD e Padrões de Projeto

**Componente:** `CheckoutService` da EntregasJá
**Stack:** Node.js 22 · Jest (unitário/integração) · @cucumber/cucumber (BDD)

> Esta documento descreve a reescita do componente legado a partir dos testes (Test-First), cobrindo os 5 fluxos da matriz de rastreabilidade e aplicação de padrões de teste e refatorações clássicas de Fowler para eliminar o acoplamento rígido e os *test smells*.

---

## 1. Como rodar

```bash
npm install
npm test        # suíte Jest (unitário + integração) com cobertura
npm run test:bdd  # cenários Gherkin (Cucumber)
```

Resultado atual: **57 testes Jest verdes**, **100% de cobertura de branches** do código de produção, **5 cenários BDD verdes**.

---

## 2. Especificação viva — BDD (Gherkin)

Arquivo: [`features/checkout.feature`](../features/checkout.feature) — escrito em português (`# language: pt`), estrutura **Dado-Quando-Então**. Cada cenário mapeia um fluxo da matriz de rastreabilidade da especificação:

| Cenário Gherkin                            | Fluxo   | Status final     | HTTP |
| :------------------------------------------ | :------ | :--------------- | :--- |
| Pagamento aprovado (caminho feliz)          | Fluxo 1 | `PROCESSADO`   | 200  |
| Pagamento recusado (falha de negócio)      | Fluxo 2 | `FALHOU`       | 500  |
| Resiliência (recupera após 1 retentativa) | Fluxo 3 | `PROCESSADO`   | 200  |
| Caos total (esgota retentativas)            | Fluxo 4 | `ERRO_GATEWAY` | 500  |
| Circuit breaker aberto curto-circuita       | RN07    | `ERRO_GATEWAY` | 500  |

> O Fluxo 5 (payload incompleto → 400) é validado na camada de controle e coberto por testes unitários de [`validacaoCheckout`](../src/http/validacaoCheckout.js).

Os *steps* ([`features/steps/checkout.steps.js`](../features/steps/checkout.steps.js)) usam dublês manuais (sem Jest, pois o Cucumber roda fora dele) e um *World* ([`features/support/world.js`](../features/support/world.js)) que centraliza o estado, evitando variáveis globais.

---

## 3. Ciclo TDD (Vermelho → Verde → Refatore)

O desenvolvimento seguiu *baby steps*. Exemplo do fluxo de resiliência:

1. **🔴 Vermelho:** escrito o teste "executa 1 retry, recupera-se e conclui como `PROCESSADO`" — falha, pois o legado não tinha retry.
2. **🟢 Verde:** implementado `executarComRetry` com o mínimo para passar.
3. **🔵 Refatore:** extraída a espera para um relógio injetável (`clock`), parametrizado o backoff e classificado o erro retentável em módulo próprio — testes seguem verdes.

O mesmo ciclo guiou timeout (RN04), circuit breaker (RN07) e o disparo assíncrono de e-mail (RF02).

---

## 4. Test Patterns aplicados

### 4.1. Data Builder + Object Mother

[`test/builders/PedidoBuilder.js`](../test/builders/PedidoBuilder.js) — API fluente (`umPedido().comValor(0).semCartao().build()`). Cada teste declara só o que é relevante; o resto vem de um padrão válido. Combate o *smell* **Obscure Setup**.

### 4.2. Stubs (estado) × Mocks (comportamento)

[`test/builders/dublesTeste.js`](../test/builders/dublesTeste.js):

| Dublê                                                           | Tipo           | Uso                                                                 |
| :--------------------------------------------------------------- | :------------- | :------------------------------------------------------------------ |
| `gatewayQueResponde`, `gatewayInstavel`, `gatewayForaDoAr` | **Stub** | injeta estado/resposta do gateway                                   |
| `repositorioEmMemoria`                                         | **Stub** | ecoa o pedido salvo                                                 |
| `emailMock`                                                    | **Mock** | asserção de comportamento: e-mail enviado**só** no sucesso |
| `relogioFake`                                                  | **Stub** | torna backoff/timeout determinísticos (sem espera real)            |

A regra de negócio crítica (RN03: "jamais enviar e-mail em pedido `FALHOU`") é verificada por um Mock: `expect(email.enviarConfirmacao).not.toHaveBeenCalled()`.

---

## 5. Test Smells eliminados (legado → redesenho)

| Smell                                     | No legado                                              | Correção                             |
| :---------------------------------------- | :----------------------------------------------------- | :------------------------------------- |
| **Obscure Setup**                   | montar pedido/dependências à mão em cada teste      | Data Builder + Object Mother           |
| **Hard-Coded Test Data**            | números mágicos`2000`, `500`, `0.5` no fluxo   | Parameter Object`config/resiliencia` |
| **Eager Test / lógica acoplada**   | e-mail síncrono dentro do fluxo de aprovação        | disparo assíncrono isolado + Mock     |
| **Indirect Testing / Erratic Test** | `setTimeout` real tornaria o teste lento e instável | relógio injetável (`clock`)        |
| **Conditional Test Logic**          | `if/else` sobre status espalhado                     | tabela de desfechos (lookup)           |

---

## 6. Refatorações de Fowler aplicadas

| Refatoração                                            | Onde                                                                                                             | Efeito                                                                     |
| :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| **Introduce Parameter Object**                     | [`config/resiliencia.js`](../src/config/resiliencia.js)                                                           | agrupa timeout/retry/backoff/limite num objeto único                      |
| **Replace Conditional with Polymorphism** (lookup) | [`services/desfechosNegocio.js`](../src/services/desfechosNegocio.js)                                             | remove a cadeia`if/else` de status; novo status = nova entrada na tabela |
| **Extract Method**                                 | métodos privados`#cobrarComResiliencia`, `#concluirNegocio`, `#acionarFallback`, `#notificarAssincrono` | `processar` lê como um resumo de alto nível                            |
| **Extract Class**                                  | `CircuitBreaker`, `executarComRetry`, `clock`, `errosInfra`                                              | cada política de resiliência isolada e testável                         |
| **Dependency Injection**                           | construtor de`CheckoutService`                                                                                 | elimina acoplamento rígido a gateway/repo/e-mail/relógio                 |

### Impacto na Complexidade Ciclomática

A análise estrutural mediu **V(G) = 3** no legado, mas ele cobria só 3 dos 5 fluxos. O redesenho adiciona timeout, retry, backoff e circuit breaker — se feito num único método monolítico, V(G) saltaria para ~9–10. Ao **extrair** cada política para sua própria unidade, mantivemos **V(G) ≤ 4 por método**, conforme a meta de *clean code* da análise estrutural.

---

## 7. Mapa da arquitetura redesenhada

```
src/
  config/resiliencia.js        Parameter Object (timeout/retry/backoff/limite)
  resilience/
    clock.js                   relógio injetável + TimeoutError (RN04)
    CircuitBreaker.js          disjuntor próprio (RN07)
    executarComRetry.js        retry + backoff (RN05/RN06)
    errosInfra.js              classifica erro retentável
  services/
    desfechosNegocio.js        tabela status → desfecho (RF02/RF03)
    CheckoutService.js         orquestração (DI, sem if/else, e-mail assíncrono)
  http/validacaoCheckout.js    contrato de entrada (RF01/Fluxo 5)
  server.js                    wiring Express + mapeamento de status → HTTP

features/                      BDD (Gherkin + steps + world)
test/                          Jest: builders, dublês e specs por módulo
```

---

## 8. Rastreabilidade requisito → teste

| Requisito                            | Implementação                                                | Teste-chave                               |
| :----------------------------------- | :------------------------------------------------------------- | :---------------------------------------- |
| RF01 (validação)                   | `validacaoCheckout.js`                                       | `test/http/validacaoCheckout.test.js`   |
| RF02 (aprovado + e-mail assíncrono) | `CheckoutService#concluirNegocio` / `#notificarAssincrono` | "dispara o e-mail de forma assíncrona"   |
| RF03 (recusado, sem e-mail)          | `desfechosNegocio`                                           | "marca FALHOU e NÃO envia e-mail"        |
| RN04 (timeout 2s)                    | `clock.comTimeout`                                           | `clock.test.js`                         |
| RN05/RN06 (retry 3x / backoff 500ms) | `executarComRetry`                                           | `executarComRetry.test.js`              |
| RN07 (circuit breaker / fallback)    | `CircuitBreaker` + `#acionarFallback`                      | `CircuitBreaker.test.js` + cenário BDD |

# Teste de Mutação (A Prova de Fogo do Código)

**Ferramenta:** Stryker.js 9.6 (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`)
**Meta obrigatória:** Mutation Score ≥ 90% (tabela de avaliação)
**Resultado alcançado:** **99,51%** ✅

> 100% de cobertura de linhas não garante eficácia. O teste de mutação injeta defeitos artificiais (mutantes) no código de produção e verifica se a suíte os detecta ("mata"). Mutantes que sobrevivem revelam asserções fracas.

---

## 1. Como rodar

```bash
npm run test:mutation
```

Relatório HTML navegável gerado em `reports/mutation/index.html`. Configuração em [`stryker.conf.json`](../stryker.conf.json): runner Jest, `coverageAnalysis: perTest`, alvo `src/**/*.js` (exceto `server.js`, que é apenas *wiring* do Express), e `break threshold = 90`.

---

## 2. Resultado por arquivo

| Arquivo                        |   Mutation Score |        Mortos |   Sobreviventes |
| :----------------------------- | ---------------: | ------------: | --------------: |
| config/resiliencia.js          |          100,00% |             4 |               0 |
| http/validacaoCheckout.js      |           98,41% |            62 | 1 (equivalente) |
| resilience/CircuitBreaker.js   |          100,00% |            29 |               0 |
| resilience/clock.js            |          100,00% |             9 |               0 |
| resilience/errosInfra.js       |          100,00% |            28 |               0 |
| resilience/executarComRetry.js |          100,00% |            16 |               0 |
| services/CheckoutService.js    |          100,00% |            31 |               0 |
| services/desfechosNegocio.js   |          100,00% |            21 |               0 |
| **Total**                | **99,51%** | **200** |     **1** |

---

## 3. Evolução: 1ª execução → suíte endurecida

A primeira rodada deu **92,61%** com 15 mutantes sobreviventes. Cada sobrevivente expôs uma fraqueza real de asserção, corrigida com testes dirigidos:

| Mutante sobrevivente                                         | Por que sobreviveu                                                                | Teste que passou a matá-lo                                                                            |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `ERRO_GATEWAY: ''` (constante STATUS)                      | testes comparavam`status` contra a própria constante mutada (auto-referência) | asserção com**literal** `'ERRO_GATEWAY'` no Fluxo 4                                          |
| `ESTADOS.FECHADO/ABERTO → ''`                             | mesma auto-referência via`ESTADOS.*`                                           | asserção literal`'FECHADO'`/`'ABERTO'`                                                           |
| `new CircuitBreaker({ ... }) → {}`                        | nenhum teste usava config ≠ do padrão                                           | teste que injeta`config` custom e confere `limiteErro`/`volumeMinimo` no breaker                 |
| `.catch(erro => console.error(...)) → () => undefined`    | falha de e-mail não verificava o log                                             | spy em`console.error` no teste de SMTP fora do ar                                                    |
| `console.error('...') → console.error('')`                | mensagem de log não era asserida                                                 | spy com`expect.stringContaining('Falha ao enviar e-mail')`                                           |
| Regex de e-mail (âncoras`^`/`$`, quantificadores `+`) | poucos formatos inválidos testados                                               | 9 e-mails mal formados, incl. espaço inicial/final e partes vazias (`@b.com`, `a@.com`, `a@b.`) |
| `typeof email === 'string'` → `true`                    | string coercível não era testada                                                | e-mail como**array** `['a@b.com']` (coage para padrão válido, mas não é string)            |
| `typeof erro.status === 'number'` → `true`              | status string não era testado                                                    | `ehErroDeInfra({ status: '600' })` deve ser `false`                                                |
| `Number.isFinite(valor)` (condicional)                     | `Infinity` não era testado                                                     | `Infinity`/`-Infinity` adicionados aos valores rejeitados                                          |
| `clearTimeout(timer)` (cleanup) → removido                | ninguém observava a limpeza do timer                                             | spy em`clearTimeout` após `comTimeout` resolver                                                   |

Resultado: de **75 testes** a suíte passou a matar 200 mutantes, subindo o score de 92,61% para **99,51%**.

---

## 4. Análise do mutante sobrevivente (mutante equivalente)

Resta **1 sobrevivente**, e ele é **equivalente** — semanticamente idêntico ao original, portanto **impossível de matar por qualquer teste**:

**Local:** [`src/http/validacaoCheckout.js:11`](../src/http/validacaoCheckout.js#L11)

```js
function ehValorValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}
```

**Mutação (ConditionalExpression):** substituir `typeof valor === 'number'` por `true`:

```js
return true && Number.isFinite(valor) && valor > 0;
```

**Justificativa técnica da equivalência:**
`Number.isFinite(x)` (método estático do ES2015, diferente do global `isFinite`) retorna `true` **somente** quando `x` já é do tipo `number` — ele **não coage** valores. Logo, sempre que `Number.isFinite(valor)` é verdadeiro, `typeof valor === 'number'` também é. A primeira condição é, portanto, **logicamente redundante**: para todo valor de entrada possível (string, `null`, `BigInt`, `Symbol`, `Infinity`, objeto, etc.), o resultado da expressão original e o da mutada são idênticos. Não existe entrada capaz de distinguir os dois ramos — o mutante é **equivalente** e foi deliberadamente mantido.

> Observação de clean code: a checagem `typeof` é mantida no código por clareza de intenção e robustez a refatorações futuras, mesmo sendo redundante hoje.

---

## 5. Notas de execução

- **2 mutantes por timeout** (em `executarComRetry` e `clock`): contam como **mortos** — o mutante criou laço/espera que estourou o tempo-limite, ou seja, foi detectado.
- **5 erros de runtime** em mutações de `clock.js` (timers reais): o Stryker os classifica em bucket próprio, **fora do denominador** do score — não penalizam nem inflam o resultado.
- O score efetivo de **99,51%** considera 200 mortos / (200 mortos + 1 equivalente sobrevivente), muito acima da meta de 90%.

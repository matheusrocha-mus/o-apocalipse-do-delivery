'use strict';

const { CONFIG_PADRAO, criarConfigResiliencia } = require('../../src/config/resiliencia');

describe('criarConfigResiliencia', () => {
  it('reflete os parâmetros da especificação por padrão', () => {
    expect(CONFIG_PADRAO).toMatchObject({
      timeoutMs: 2000,
      maxTentativas: 4,
      backoffMs: 500,
      limiteErro: 0.5,
    });
  });

  it('devolve uma cópia com os padrões quando não há overrides', () => {
    expect(criarConfigResiliencia()).toEqual(CONFIG_PADRAO);
  });

  it('permite sobrescrever apenas os campos informados', () => {
    const config = criarConfigResiliencia({ timeoutMs: 100, backoffMs: 1 });
    expect(config.timeoutMs).toBe(100);
    expect(config.backoffMs).toBe(1);
    expect(config.maxTentativas).toBe(4); // preserva o restante
  });
});

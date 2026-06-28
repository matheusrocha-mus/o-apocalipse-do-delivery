'use strict';

const { executarComRetry } = require('../../src/resilience/executarComRetry');

function opcoes(overrides = {}) {
  return {
    maxTentativas: 4,
    backoffMs: 500,
    aguardar: jest.fn().mockResolvedValue(undefined),
    ehRetentavel: () => true,
    ...overrides,
  };
}

describe('executarComRetry', () => {
  it('retorna na primeira tentativa quando a operação tem sucesso (sem espera)', async () => {
    const operacao = jest.fn().mockResolvedValue('ok');
    const opts = opcoes();

    const resultado = await executarComRetry(operacao, opts);

    expect(resultado).toBe('ok');
    expect(operacao).toHaveBeenCalledTimes(1);
    expect(opts.aguardar).not.toHaveBeenCalled();
  });

  it('reexecuta após falha retentável e devolve o sucesso seguinte', async () => {
    const operacao = jest
      .fn()
      .mockRejectedValueOnce(new Error('falha 1'))
      .mockResolvedValue('ok');
    const opts = opcoes();

    const resultado = await executarComRetry(operacao, opts);

    expect(resultado).toBe('ok');
    expect(operacao).toHaveBeenCalledTimes(2);
    expect(opts.aguardar).toHaveBeenCalledTimes(1);
    expect(opts.aguardar).toHaveBeenCalledWith(500);
  });

  it('esgota exatamente maxTentativas e relança o último erro', async () => {
    const erroFinal = new Error('persistente');
    const operacao = jest.fn().mockRejectedValue(erroFinal);
    const opts = opcoes();

    await expect(executarComRetry(operacao, opts)).rejects.toBe(erroFinal);
    expect(operacao).toHaveBeenCalledTimes(4);
    expect(opts.aguardar).toHaveBeenCalledTimes(3); // não espera após a última
  });

  it('com maxTentativas 0 não executa a operação e rejeita (guarda defensiva)', async () => {
    const operacao = jest.fn();
    const opts = opcoes({ maxTentativas: 0 });

    await expect(executarComRetry(operacao, opts)).rejects.toBeUndefined();
    expect(operacao).not.toHaveBeenCalled();
  });

  it('aborta imediatamente quando o erro não é retentável', async () => {
    const erro = new Error('erro de negócio fatal');
    const operacao = jest.fn().mockRejectedValue(erro);
    const opts = opcoes({ ehRetentavel: () => false });

    await expect(executarComRetry(operacao, opts)).rejects.toBe(erro);
    expect(operacao).toHaveBeenCalledTimes(1);
    expect(opts.aguardar).not.toHaveBeenCalled();
  });
});

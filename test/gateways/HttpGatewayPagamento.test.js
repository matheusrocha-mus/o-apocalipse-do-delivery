'use strict';

const { HttpGatewayPagamento } = require('../../src/gateways/HttpGatewayPagamento');

function respostaFake(status, corpo = {}) {
  return { status, json: jest.fn().mockResolvedValue(corpo) };
}

describe('HttpGatewayPagamento', () => {
  const BASE = 'http://localhost:21090';

  it('usa o fetch global por padrão quando nenhum é injetado', () => {
    const gw = new HttpGatewayPagamento(BASE);
    expect(gw.fetch).toBe(globalThis.fetch);
  });

  it('faz POST em /cobrar e devolve o corpo JSON em caso de sucesso', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respostaFake(200, { status: 'APROVADO' }));
    const gw = new HttpGatewayPagamento(BASE, fetchImpl);

    const resposta = await gw.cobrar(100, { numero: '4111' });

    expect(resposta).toEqual({ status: 'APROVADO' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:21090/cobrar',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: 100, cartao: { numero: '4111' } }),
      }),
    );
  });

  it('lança erro com .status e mensagem quando o gateway responde 5xx (retentável)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respostaFake(503));
    const gw = new HttpGatewayPagamento(BASE, fetchImpl);

    await expect(gw.cobrar(100, {})).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('Gateway respondeu 503'),
    });
  });

  it('lança no limite exato 500 (>= é inclusivo)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respostaFake(500));
    const gw = new HttpGatewayPagamento(BASE, fetchImpl);

    await expect(gw.cobrar(100, {})).rejects.toMatchObject({ status: 500 });
  });

  it('NÃO lança em respostas < 500 (ex.: 200 e 499) e retorna o corpo', async () => {
    const gw200 = new HttpGatewayPagamento(
      BASE,
      jest.fn().mockResolvedValue(respostaFake(200, { status: 'RECUSADO' })),
    );
    await expect(gw200.cobrar(100, {})).resolves.toEqual({ status: 'RECUSADO' });

    const gw499 = new HttpGatewayPagamento(
      BASE,
      jest.fn().mockResolvedValue(respostaFake(499, { status: 'APROVADO' })),
    );
    await expect(gw499.cobrar(100, {})).resolves.toEqual({ status: 'APROVADO' });
  });

  it('normaliza falha de rede preservando o code e descrevendo a causa', async () => {
    const causa = new Error('socket hang up');
    causa.code = 'ECONNRESET';
    const fetchImpl = jest.fn().mockRejectedValue(causa);
    const gw = new HttpGatewayPagamento(BASE, fetchImpl);

    await expect(gw.cobrar(100, {})).rejects.toMatchObject({
      code: 'ECONNRESET',
      message: expect.stringContaining('Falha de rede'),
    });
  });

  it('usa ECONNREFUSED como code padrão quando a causa não traz um', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('sem code'));
    const gw = new HttpGatewayPagamento(BASE, fetchImpl);

    await expect(gw.cobrar(100, {})).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});

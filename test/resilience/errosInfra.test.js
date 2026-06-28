'use strict';

const { ehErroDeInfra } = require('../../src/resilience/errosInfra');
const { TimeoutError } = require('../../src/resilience/clock');

describe('ehErroDeInfra', () => {
  it('classifica TimeoutError (ETIMEDOUT) como erro de infra', () => {
    expect(ehErroDeInfra(new TimeoutError(2000))).toBe(true);
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'])(
    'classifica o código de rede %s como erro de infra',
    (code) => {
      expect(ehErroDeInfra({ code })).toBe(true);
    },
  );

  it('classifica HTTP 5xx como erro de infra', () => {
    expect(ehErroDeInfra({ status: 500 })).toBe(true);
    expect(ehErroDeInfra({ status: 503 })).toBe(true);
  });

  it('NÃO classifica HTTP 4xx como erro de infra', () => {
    expect(ehErroDeInfra({ status: 400 })).toBe(false);
    expect(ehErroDeInfra({ status: 499 })).toBe(false);
  });

  it('exige que status seja numérico (string "600" não conta como 5xx)', () => {
    expect(ehErroDeInfra({ status: '600' })).toBe(false);
  });

  it('NÃO classifica erro comum sem código/status conhecido', () => {
    expect(ehErroDeInfra(new Error('erro qualquer'))).toBe(false);
  });

  it('retorna false para valores ausentes', () => {
    expect(ehErroDeInfra(null)).toBe(false);
    expect(ehErroDeInfra(undefined)).toBe(false);
  });
});

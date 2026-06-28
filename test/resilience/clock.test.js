'use strict';

const { relogioReal, TimeoutError } = require('../../src/resilience/clock');

describe('relogioReal', () => {
  describe('aguardar', () => {
    it('resolve após o tempo solicitado', async () => {
      await expect(relogioReal.aguardar(10)).resolves.toBeUndefined();
    });
  });

  describe('comTimeout', () => {
    it('resolve com o valor da promessa quando ela termina antes do limite', async () => {
      const rapida = new Promise((resolve) => setTimeout(() => resolve('valor'), 5));
      await expect(relogioReal.comTimeout(rapida, 100)).resolves.toBe('valor');
    });

    it('rejeita com TimeoutError quando a promessa estoura o limite', async () => {
      const lenta = new Promise((resolve) => setTimeout(() => resolve('tarde'), 100));
      await expect(relogioReal.comTimeout(lenta, 10)).rejects.toBeInstanceOf(TimeoutError);
    });

    it('propaga a rejeição original quando a promessa falha antes do limite', async () => {
      const erro = new Error('falhou');
      const quebrada = Promise.reject(erro);
      await expect(relogioReal.comTimeout(quebrada, 100)).rejects.toBe(erro);
    });
  });

  describe('TimeoutError', () => {
    it('carrega o código ETIMEDOUT e a duração na mensagem', () => {
      const erro = new TimeoutError(2000);
      expect(erro.code).toBe('ETIMEDOUT');
      expect(erro.name).toBe('TimeoutError');
      expect(erro.message).toContain('2000');
    });
  });
});

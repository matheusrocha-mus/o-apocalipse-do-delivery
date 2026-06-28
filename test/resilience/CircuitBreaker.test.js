'use strict';

const { CircuitBreaker, ESTADOS } = require('../../src/resilience/CircuitBreaker');

describe('CircuitBreaker', () => {
  it('começa fechado e com taxa de erro zero', () => {
    const cb = new CircuitBreaker();
    expect(cb.aberto()).toBe(false);
    expect(cb.estado).toBe(ESTADOS.FECHADO);
    expect(cb.taxaErro).toBe(0);
    expect(cb.total).toBe(0);
  });

  it('não abre enquanto não atingir o volume mínimo, mesmo com 100% de erro', () => {
    const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
    cb.registrarFalha();
    cb.registrarFalha();
    cb.registrarFalha(); // 3 falhas, abaixo do volume mínimo (4)
    expect(cb.aberto()).toBe(false);
  });

  it('abre quando a taxa de erro ultrapassa o limite após o volume mínimo', () => {
    const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
    cb.registrarFalha();
    cb.registrarFalha();
    cb.registrarFalha();
    cb.registrarSucesso(); // 3/4 = 75% > 50%
    expect(cb.taxaErro).toBeCloseTo(0.75);
    expect(cb.aberto()).toBe(true);
    expect(cb.estado).toBe(ESTADOS.ABERTO);
  });

  it('permanece fechado quando a taxa de erro é exatamente igual ao limite (limite é estrito)', () => {
    const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
    cb.registrarFalha();
    cb.registrarFalha();
    cb.registrarSucesso();
    cb.registrarSucesso(); // 2/4 = 50%, NÃO é > 50%
    expect(cb.taxaErro).toBe(0.5);
    expect(cb.aberto()).toBe(false);
  });

  it('usa os valores-padrão (limite 0.5 / volume 4) quando construído sem argumentos', () => {
    const cb = new CircuitBreaker();
    expect(cb.limiteErro).toBe(0.5);
    expect(cb.volumeMinimo).toBe(4);
  });
});

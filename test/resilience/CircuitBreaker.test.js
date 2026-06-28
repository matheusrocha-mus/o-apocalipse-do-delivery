'use strict';

const { CircuitBreaker, ESTADOS } = require('../../src/resilience/CircuitBreaker');

/** Relógio controlável para tornar o cooldown determinístico. */
function relogioControlavel(inicial = 0) {
  let t = inicial;
  return {
    agora: () => t,
    avancar: (ms) => {
      t += ms;
    },
  };
}

function abrir(cb) {
  // 4 falhas com volume mínimo 4 e limite 0.5 => taxa 1.0 > 0.5 => abre.
  cb.registrarFalha();
  cb.registrarFalha();
  cb.registrarFalha();
  cb.registrarFalha();
}

describe('CircuitBreaker', () => {
  it('começa fechado e com taxa de erro zero', () => {
    const cb = new CircuitBreaker();
    expect(cb.aberto()).toBe(false);
    expect(cb.estado).toBe(ESTADOS.FECHADO);
    expect(cb.taxaErro).toBe(0);
    expect(cb.total).toBe(0);
  });

  it('expõe os rótulos literais de estado', () => {
    expect(ESTADOS.FECHADO).toBe('FECHADO');
    expect(ESTADOS.ABERTO).toBe('ABERTO');
    expect(ESTADOS.MEIO_ABERTO).toBe('MEIO_ABERTO');
  });

  it('usa os valores-padrão (limite 0.5 / volume 4 / cooldown 10000) sem argumentos', () => {
    const cb = new CircuitBreaker();
    expect(cb.limiteErro).toBe(0.5);
    expect(cb.volumeMinimo).toBe(4);
    expect(cb.cooldownMs).toBe(10000);
  });

  it('usa um relógio real por padrão (agora retorna um timestamp numérico)', () => {
    const cb = new CircuitBreaker();
    expect(typeof cb.agora()).toBe('number');
  });

  describe('abertura por taxa de erro', () => {
    it('não abre enquanto não atingir o volume mínimo, mesmo com 100% de erro', () => {
      const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
      cb.registrarFalha();
      cb.registrarFalha();
      cb.registrarFalha(); // 3 falhas, abaixo do volume mínimo (4)
      expect(cb.aberto()).toBe(false);
      expect(cb.estado).toBe(ESTADOS.FECHADO);
    });

    it('abre quando a taxa de erro ultrapassa o limite após o volume mínimo', () => {
      const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
      cb.registrarSucesso();
      cb.registrarSucesso();
      cb.registrarFalha();
      cb.registrarFalha();
      cb.registrarFalha(); // 3/5 = 60% > 50%
      expect(cb.taxaErro).toBeCloseTo(0.6);
      expect(cb.aberto()).toBe(true);
      expect(cb.estado).toBe('ABERTO');
    });

    it('permanece fechado quando a taxa é exatamente igual ao limite (limite estrito)', () => {
      const cb = new CircuitBreaker({ limiteErro: 0.5, volumeMinimo: 4 });
      cb.registrarSucesso();
      cb.registrarSucesso();
      cb.registrarFalha();
      cb.registrarFalha(); // 2/4 = 50%, NÃO é > 50%
      expect(cb.taxaErro).toBe(0.5);
      expect(cb.aberto()).toBe(false);
    });
  });

  describe('janela deslizante', () => {
    it('mantém apenas os últimos `janela` eventos', () => {
      const cb = new CircuitBreaker({ janela: 4, volumeMinimo: 100 }); // volume alto: não abre
      for (let i = 0; i < 6; i += 1) {
        cb.registrarSucesso();
      }
      expect(cb.total).toBe(4);
    });

    it('esquece eventos antigos ao calcular a taxa de erro', () => {
      const cb = new CircuitBreaker({ janela: 4, volumeMinimo: 100 });
      cb.registrarSucesso();
      cb.registrarSucesso();
      cb.registrarFalha();
      cb.registrarFalha();
      cb.registrarFalha(); // empurra para fora o 1º sucesso => janela [s,f,f,f]
      expect(cb.total).toBe(4);
      expect(cb.falhas).toBe(3);
      expect(cb.sucessos).toBe(1);
      expect(cb.taxaErro).toBeCloseTo(0.75);
    });

    it('um histórico de sucessos não impede a abertura por erros recentes', () => {
      const cb = new CircuitBreaker({ janela: 10, volumeMinimo: 4, limiteErro: 0.5 });
      for (let i = 0; i < 6; i += 1) {
        cb.registrarSucesso(); // 6 sucessos
      }
      for (let i = 0; i < 6; i += 1) {
        cb.registrarFalha(); // 6 falhas recentes => janela [s,s,s,s,f,f,f,f,f,f] = 60% erro
      }
      expect(cb.aberto()).toBe(true);
    });
  });

  describe('cooldown e recuperação (half-open)', () => {
    it('nega requisições enquanto ABERTO dentro do cooldown', () => {
      const relogio = relogioControlavel();
      const cb = new CircuitBreaker({ volumeMinimo: 4, cooldownMs: 10000, agora: relogio.agora });
      abrir(cb);

      relogio.avancar(9999); // ainda dentro do cooldown
      expect(cb.permiteRequisicao()).toBe(false);
      expect(cb.estado).toBe('ABERTO');
    });

    it('transita para MEIO_ABERTO e libera 1 sondagem quando o cooldown decorre', () => {
      const relogio = relogioControlavel();
      const cb = new CircuitBreaker({ volumeMinimo: 4, cooldownMs: 10000, agora: relogio.agora });
      abrir(cb);

      relogio.avancar(10000); // cooldown exatamente atingido (>=)
      expect(cb.permiteRequisicao()).toBe(true);
      expect(cb.estado).toBe('MEIO_ABERTO');
    });

    it('uma sondagem bem-sucedida FECHA o breaker e zera os contadores (recuperação)', () => {
      const relogio = relogioControlavel();
      const cb = new CircuitBreaker({ volumeMinimo: 4, cooldownMs: 10000, agora: relogio.agora });
      abrir(cb);
      relogio.avancar(10000);
      cb.permiteRequisicao(); // -> MEIO_ABERTO

      cb.registrarSucesso();

      expect(cb.estado).toBe('FECHADO');
      expect(cb.total).toBe(0);
      expect(cb.aberto()).toBe(false);
    });

    it('uma sondagem que falha REABRE o breaker e reinicia o cooldown', () => {
      const relogio = relogioControlavel();
      const cb = new CircuitBreaker({ volumeMinimo: 4, cooldownMs: 10000, agora: relogio.agora });
      abrir(cb);
      relogio.avancar(10000);
      cb.permiteRequisicao(); // -> MEIO_ABERTO

      relogio.avancar(5);
      cb.registrarFalha();

      expect(cb.estado).toBe('ABERTO');
      // a falha de sondagem não incrementa o contador: vai direto pelo ramo MEIO_ABERTO
      expect(cb.falhas).toBe(4);
      expect(cb.permiteRequisicao()).toBe(false); // cooldown reiniciado
    });
  });

  it('permite requisições normalmente quando FECHADO', () => {
    const cb = new CircuitBreaker();
    expect(cb.permiteRequisicao()).toBe(true);
  });
});

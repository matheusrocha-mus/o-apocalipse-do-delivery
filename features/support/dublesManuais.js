'use strict';

/**
 * Dublês de teste SEM dependência do Jest (o Cucumber roda fora do Jest).
 * `espiar` é um Mock manual mínimo que registra as chamadas para asserção
 * de comportamento.
 */
function espiar(implementacao) {
  const espiao = (...args) => {
    espiao.chamadas.push(args);
    return implementacao(...args);
  };
  espiao.chamadas = [];
  return espiao;
}

function gatewayQueResponde(status) {
  return { cobrar: espiar(async () => ({ status })) };
}

function gatewayInstavel(vezes, status) {
  let restantes = vezes;
  return {
    cobrar: espiar(async () => {
      if (restantes > 0) {
        restantes -= 1;
        const erro = new Error('Instabilidade de rede');
        erro.code = 'ECONNREFUSED';
        throw erro;
      }
      return { status };
    }),
  };
}

function gatewayForaDoAr() {
  return {
    cobrar: espiar(async () => {
      const erro = new Error('Gateway fora do ar');
      erro.code = 'ECONNREFUSED';
      throw erro;
    }),
  };
}

function gatewayQueDaTimeout() {
  return {
    cobrar: espiar(async () => {
      const erro = new Error('Operação excedeu o timeout');
      erro.code = 'ETIMEDOUT';
      throw erro;
    }),
  };
}

function repositorioEmMemoria() {
  return { salvar: espiar(async (pedido) => ({ ...pedido, id: 1 })) };
}

function emailEspiao() {
  return { enviarConfirmacao: espiar(async () => undefined) };
}

/** Relógio falso: não espera de verdade e repassa a promessa sem timeout. */
const relogioInstantaneo = {
  agora: () => 0,
  aguardar: async () => undefined,
  comTimeout: (promessa) => promessa,
};

module.exports = {
  espiar,
  gatewayQueResponde,
  gatewayInstavel,
  gatewayForaDoAr,
  gatewayQueDaTimeout,
  repositorioEmMemoria,
  emailEspiao,
  relogioInstantaneo,
};

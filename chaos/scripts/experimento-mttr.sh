#!/usr/bin/env bash
# Experimento de caos: injeta "Gateway Lento" (5000ms), mede o tempo de detecção
# (circuit breaker ABRE) e o MTTR de recuperação (CB volta a FECHADO após remover
# o tóxico). Requer o ambiente no ar (chaos/scripts/iniciar-ambiente.ps1) e o
# app com COOLDOWN_MS curto (ex.: 3000) para um MTTR demonstrável.
#
# Uso (a partir da raiz do projeto):  bash chaos/scripts/experimento-mttr.sh
set -u
CLI=./tools/toxiproxy-cli.exe
APP=http://127.0.0.1:3000
PAYLOAD='{"clienteEmail":"a@b.com","valor":100,"cartao":{"numero":"4111","validade":"12/30","cvv":"123"}}'

estado() { curl -s $APP/api/v1/health | grep -o '"estado":"[^"]*"' | cut -d'"' -f4; }
checkout() { curl -s -o /dev/null -w "%{http_code} %{time_total}s" -X POST $APP/api/v1/checkout -H "Content-Type: application/json" -d "$PAYLOAD"; }
agora_ms() { date +%s%3N; }

echo "### Estado inicial: $(estado)"

echo ">>> Injetando tóxico: latency=5000ms no proxy gateway"
$CLI toxic add -t latency -a latency=5000 -n lat gateway >/dev/null 2>&1
T0=$(agora_ms)

echo ">>> Disparando 5 checkouts concorrentes (cada um estoura timeout/retry)..."
for i in 1 2 3 4 5; do (checkout >/dev/null 2>&1) & done

echo ">>> Aguardando o circuit breaker ABRIR..."
TOPEN=""
for i in $(seq 1 80); do
  if [ "$(estado)" = "ABERTO" ]; then TOPEN=$(agora_ms); break; fi
  sleep 0.5
done
wait
[ -n "$TOPEN" ] && echo "### CB ABRIU em $((TOPEN - T0)) ms (detecção + proteção)" \
               || echo "### CB não abriu no tempo limite"

echo ">>> Fase protegida (CB aberto) — checkouts devem falhar RÁPIDO (fast-fail):"
for i in 1 2 3; do echo "    req$i: $(checkout)  estado=$(estado)"; done

echo ">>> Removendo o tóxico (gateway volta ao normal)"
$CLI toxic remove -n lat gateway >/dev/null 2>&1
TREMOVE=$(agora_ms)

echo ">>> Medindo MTTR de recuperação (CB voltar a FECHADO via sondagem half-open)..."
TCLOSED=""
for i in $(seq 1 60); do
  C=$(checkout)
  if [ "$(estado)" = "FECHADO" ]; then TCLOSED=$(agora_ms); echo "    recuperado: $C"; break; fi
  sleep 0.5
done
[ -n "$TCLOSED" ] && echo "### MTTR (recuperação) = $((TCLOSED - TREMOVE)) ms" \
                 || echo "### Não recuperou no tempo limite"
echo "### Estado final: $(estado)"

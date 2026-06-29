# Sobe o ambiente de caos: Toxiproxy + gateway simulado + proxy + app.
# Uso:
#   pwsh chaos/scripts/iniciar-ambiente.ps1                 # cooldown padrão (10s)
#   pwsh chaos/scripts/iniciar-ambiente.ps1 -CooldownMs 5000  # demo do vídeo (MTTR rápido)
param(
  [int]$CooldownMs = 10000
)
$ErrorActionPreference = 'Stop'

$proj  = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$tools = Join-Path $proj 'tools'
$cli   = Join-Path $tools 'toxiproxy-cli.exe'

Write-Host '>>> Iniciando Toxiproxy server (API em 127.0.0.1:8474)...'
Start-Process -FilePath (Join-Path $tools 'toxiproxy-server.exe') -WindowStyle Hidden
Start-Sleep -Seconds 1

Write-Host '>>> Iniciando gateway de pagamento simulado (porta 9090)...'
Start-Process -FilePath 'node' -ArgumentList "`"$proj\chaos\gateway-sim\server.js`"" -WindowStyle Hidden
Start-Sleep -Seconds 1

Write-Host '>>> Criando o proxy gateway (21090 -> 9090)...'
& $cli create -l 127.0.0.1:21090 -u 127.0.0.1:9090 gateway

Write-Host '>>> Iniciando o app (porta 3000) apontando para o Toxiproxy...'
$env:GATEWAY_URL = 'http://127.0.0.1:21090'
$env:JITTER_MS   = '250'              # jitter anti-thundering-herd
$env:COOLDOWN_MS = "$CooldownMs"      # cooldown do circuit breaker
Start-Process -FilePath 'node' -ArgumentList "`"$proj\src\server.js`"" -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host '>>> Pronto. Health:' -ForegroundColor Green
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/health).Content

# Injeta (ou remove) toxicos na infraestrutura via Toxiproxy.
# Uso:
#   powershell -ExecutionPolicy Bypass -File chaos\scripts\injetar-caos.ps1 gateway-lento   # +5000ms na API de pagamento
#   powershell -ExecutionPolicy Bypass -File chaos\scripts\injetar-caos.ps1 gateway-down     # derruba o gateway
#   powershell -ExecutionPolicy Bypass -File chaos\scripts\injetar-caos.ps1 limpar           # remove toxicos / restabelece
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('gateway-lento', 'gateway-down', 'limpar')]
  [string]$tipo
)
$ErrorActionPreference = 'Stop'
$cli = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'tools\toxiproxy-cli.exe'
$api = 'http://127.0.0.1:8474/proxies/gateway'

function Set-ProxyEnabled([bool]$enabled) {
  $body = @{ enabled = $enabled } | ConvertTo-Json
  # UserAgent custom: o Toxiproxy bloqueia agentes "de navegador" (anti-CSRF).
  Invoke-RestMethod -Method Post -Uri $api -Body $body -ContentType 'application/json' `
    -UserAgent 'toxiproxy-client' | Out-Null
}

switch ($tipo) {
  'gateway-lento' {
    Write-Host '>>> Gateway Lento: +5000ms de latencia na chamada de pagamento' -ForegroundColor Yellow
    & $cli toxic add -t latency -a latency=5000 -n lat gateway
  }
  'gateway-down' {
    Write-Host '>>> Gateway Down: desabilitando o proxy (conexoes recusadas)' -ForegroundColor Red
    Set-ProxyEnabled $false
  }
  'limpar' {
    Write-Host '>>> Limpando toxicos e reabilitando o proxy' -ForegroundColor Green
    # 2>&1 manda o stderr para o stream de saida (evita o erro "toxic not found"
    # quando nao ha toxico para remover); o try/catch e a rede de seguranca.
    try { & $cli toxic remove -n lat gateway 2>&1 | Out-Null } catch {}
    Set-ProxyEnabled $true
    Write-Host 'OK: proxy sem toxicos e habilitado.' -ForegroundColor Green
  }
}
& $cli inspect gateway

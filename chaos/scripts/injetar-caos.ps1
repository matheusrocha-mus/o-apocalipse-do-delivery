# Injeta (ou remove) tóxicos na infraestrutura via Toxiproxy.
# Uso:
#   pwsh chaos/scripts/injetar-caos.ps1 gateway-lento   # +5000ms na API de pagamento
#   pwsh chaos/scripts/injetar-caos.ps1 gateway-down     # derruba o gateway
#   pwsh chaos/scripts/injetar-caos.ps1 limpar           # remove tóxicos / restabelece
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
  Invoke-RestMethod -Method Post -Uri $api -Body $body -ContentType 'application/json' | Out-Null
}

switch ($tipo) {
  'gateway-lento' {
    Write-Host '>>> Gateway Lento: +5000ms de latência na chamada de pagamento' -ForegroundColor Yellow
    & $cli toxic add -t latency -a latency=5000 -n lat gateway
  }
  'gateway-down' {
    Write-Host '>>> Gateway Down: desabilitando o proxy (conexões recusadas)' -ForegroundColor Red
    Set-ProxyEnabled $false
  }
  'limpar' {
    Write-Host '>>> Limpando tóxicos e reabilitando o proxy' -ForegroundColor Green
    & $cli toxic remove -n lat gateway 2>$null
    Set-ProxyEnabled $true
  }
}
& $cli inspect gateway

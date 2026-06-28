# Baixa os binários nativos de k6 e Toxiproxy para tools/ (sem admin, sem Docker).
# Uso: pwsh chaos/scripts/baixar-binarios.ps1
$ErrorActionPreference = 'Stop'
$proj  = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$tools = Join-Path $proj 'tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null

$K6 = 'v2.0.0'
$TOXI = 'v2.12.0'

Write-Host ">>> Toxiproxy $TOXI..."
Invoke-WebRequest -UseBasicParsing -OutFile (Join-Path $tools 'toxiproxy-server.exe') `
  "https://github.com/Shopify/toxiproxy/releases/download/$TOXI/toxiproxy-server-windows-amd64.exe"
Invoke-WebRequest -UseBasicParsing -OutFile (Join-Path $tools 'toxiproxy-cli.exe') `
  "https://github.com/Shopify/toxiproxy/releases/download/$TOXI/toxiproxy-cli-windows-amd64.exe"

Write-Host ">>> k6 $K6..."
$zip = Join-Path $tools 'k6.zip'
Invoke-WebRequest -UseBasicParsing -OutFile $zip `
  "https://github.com/grafana/k6/releases/download/$K6/k6-$K6-windows-amd64.zip"
Expand-Archive -Force $zip $tools
Copy-Item (Get-ChildItem $tools -Recurse -Filter k6.exe | Select-Object -First 1).FullName (Join-Path $tools 'k6.exe') -Force
Remove-Item $zip -Force
Remove-Item (Join-Path $tools "k6-$K6-windows-amd64") -Recurse -Force

Write-Host '>>> Pronto:' -ForegroundColor Green
& (Join-Path $tools 'k6.exe') version
& (Join-Path $tools 'toxiproxy-server.exe') --version

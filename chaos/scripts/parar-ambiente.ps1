# Encerra o ambiente de caos (app, gateway simulado, Toxiproxy).
# Uso: pwsh chaos/scripts/parar-ambiente.ps1
$ErrorActionPreference = 'SilentlyContinue'

Write-Host '>>> Encerrando processos node (app + gateway simulado)...'
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host '>>> Encerrando o Toxiproxy server...'
Get-Process toxiproxy-server -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host '>>> Ambiente encerrado.' -ForegroundColor Green

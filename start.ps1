# Kiosco del Recreo - lanzador para PowerShell
# Uso: powershell -ExecutionPolicy Bypass -File .\start.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$bunPath = $null
$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCommand) {
  $bunPath = $bunCommand.Source
}

if (-not $bunPath) {
  $portable = Join-Path $env:USERPROFILE 'bun-runtime\bun-windows-x64\bun.exe'
  if (Test-Path $portable) {
    $bunPath = $portable
  }
}

if (-not $bunPath) {
  Write-Host ''
  Write-Host '  No se encontro Bun.' -ForegroundColor Yellow
  Write-Host '  Instalalo desde https://bun.sh o descarga el runtime portable en:'
  Write-Host "  $env:USERPROFILE\bun-runtime\bun-windows-x64\bun.exe"
  Write-Host ''
  exit 1
}

& $bunPath run src/server.js

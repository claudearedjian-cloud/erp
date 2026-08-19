# ============================================================================
# WoodTek ERP - OPTIONAL: run as a real Windows service via NSSM
# ----------------------------------------------------------------------------
# A Windows service is the most "professional" option: it runs before login,
# auto-restarts on crash, and is managed like any other service
# (services.msc). This is an alternative to the scheduled-task approach in
# install-autostart.ps1 - pick ONE of the two.
#
# Prerequisites:
#   1. Download NSSM from https://nssm.cc/download  (nssm-2.24.zip)
#   2. Put nssm.exe next to this script (ops\nssm.exe) or on PATH
#   3. Run from an ADMINISTRATOR PowerShell
#
# Usage:  powershell -ExecutionPolicy Bypass -File ops\install-service-nssm.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Error 'Run from an ADMINISTRATOR PowerShell.'; exit 1 }

$opsDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $opsDir

$nssm = Join-Path $opsDir 'nssm.exe'
if (-not (Test-Path $nssm)) { $nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source }
if (-not $nssm) {
  Write-Error 'nssm.exe not found. Download https://nssm.cc/download and place nssm.exe in the ops folder.'
  exit 1
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { Write-Error "node.exe not found at $node"; exit 1 }

$launcher = Join-Path $appRoot 'start-prod.cjs'

& $nssm stop    WoodTekERP 2>$null | Out-Null
& $nssm remove  WoodTekERP confirm 2>$null | Out-Null

& $nssm install WoodTekERP "$node" "`"$launcher`" --no-browser"
& $nssm set WoodTekERP AppDirectory "$appRoot"
& $nssm set WoodTekERP AppStdout   "$appRoot\logs\woodtek-service.log"
& $nssm set WoodTekERP AppStderr   "$appRoot\logs\woodtek-service.err.log"
& $nssm set WoodTekERP AppRotateFiles 1
& $nssm set WoodTekERP AppRotateBytes 1048576
& $nssm set WoodTekERP Start SERVICE_AUTO_START
& $nssm set WoodTekERP AppExit Default Restart
& $nssm set WoodTekERP AppRestartDelay 3000

& $nssm start WoodTekERP | Out-Null
Write-Host 'WoodTekERP service installed and started.'
Write-Host 'Check:  http://localhost:3000/api/health   ({"ok":true})'
Write-Host 'Remove with:  nssm remove WoodTekERP confirm'

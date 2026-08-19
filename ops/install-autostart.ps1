# ============================================================================
# WoodTek ERP - auto-start on Windows boot (runs before anyone logs in)
# ----------------------------------------------------------------------------
# Registers two scheduled tasks under "WoodTek ERP":
#   1. WoodTek ERP              - starts the production server at boot (SYSTEM)
#   2. WoodTek ERP Backup       - nightly database backup at 02:30
#
# Requires an ADMINISTRATOR PowerShell. After this, the app starts
# automatically on every boot - no console window, no login required.
#
# Usage:  powershell -ExecutionPolicy Bypass -File ops\install-autostart.ps1
# Remove: powershell -ExecutionPolicy Bypass -File ops\remove-autostart.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'

# ---- must be admin ----------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error 'Run this script from an ADMINISTRATOR PowerShell (right-click PowerShell -> Run as administrator).'
  exit 1
}

$opsDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $opsDir
$silentBat = Join-Path $appRoot 'start-woodtek-prod-silent.bat'
$backupPs  = Join-Path $appRoot 'backup\backup-woodtek.ps1'
$backupBat = Join-Path $appRoot 'backup\run-backup.bat'

if (-not (Test-Path $silentBat)) { Write-Error "Missing: $silentBat"; exit 1 }

# --- 1. server auto-start task ----------------------------------------------
schtasks /Create /TN "WoodTek ERP" /TR "`"$silentBat`"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F | Out-Null
Write-Host 'Created task: WoodTek ERP (runs at boot as SYSTEM).'

# --- 2. nightly backup task --------------------------------------------------
@"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "$backupPs"
"@ | Set-Content -Path $backupBat -Encoding Ascii

schtasks /Create /TN "WoodTek ERP Backup" /TR "`"$backupBat`"" /SC DAILY /ST 02:30 /RU SYSTEM /F | Out-Null
Write-Host 'Created task: WoodTek ERP Backup (daily 02:30).'

Write-Host ''
Write-Host 'Done. Reboot to test, or start now with:'
Write-Host '  schtasks /Run /TN "WoodTek ERP"'
Write-Host ''
Write-Host 'Check the app:  http://localhost:3000/api/health   (should return {"ok":true})'

# ============================================================================
# WoodTek ERP — generate & persist a strong AUTH_SECRET into .env
# ----------------------------------------------------------------------------
# Without AUTH_SECRET the app invents an in-memory key on every start, which
# logs everyone out whenever the server restarts. This writes a random 96-char
# (hex) secret into the app's .env so sessions survive restarts.
#
# Usage:  powershell -ExecutionPolicy Bypass -File ops\set-auth-secret.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'

$opsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $opsDir
$envFile = Join-Path $appRoot '.env'

if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile — create it first (copy .env.example)."
  exit 1
}

# 48 random bytes -> 96 hex chars
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })

$content = Get-Content $envFile -Raw
if ($content -match '(?m)^AUTH_SECRET\s*=.*$') {
  $content = $content -replace '(?m)^AUTH_SECRET\s*=.*$', "AUTH_SECRET=$secret"
} else {
  $content = $content.TrimEnd() + "`r`nAUTH_SECRET=$secret`r`n"
}
Set-Content -Path $envFile -Value $content -Encoding Ascii -NoNewline

Write-Host "AUTH_SECRET written to $envFile"
Write-Host "(Sessions will now survive server restarts.)"

# ============================================================================
# WoodTek ERP — change the postgres SUPERUSER password
# ----------------------------------------------------------------------------
# The postgres superuser password is currently the factory default. Change it
# to something strong. This does NOT affect the app (the app logs in as
# woodtek_owner) — it only protects the database from LAN tampering.
#
# Usage:  powershell -ExecutionPolicy Bypass -File ops\change-postgres-password.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) { $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source }
if (-not $psql) { Write-Error 'psql.exe not found.'; exit 1 }

$current = Read-Host 'Current postgres password'
$new1 = Read-Host 'New postgres password (min 8 chars)'
$new2 = Read-Host 'Confirm new password'

if ($new1.Length -lt 8) { Write-Error 'Password too short (min 8).'; exit 1 }
if ($new1 -ne $new2)   { Write-Error 'Passwords do not match.'; exit 1 }
if ($new1 -eq '1234')  { Write-Error 'Do not reuse the old password.'; exit 1 }

$safe = $new1.Replace("'", "''")
$env:PGPASSWORD = $current
$out = & $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '$safe';" 2>&1
$code = $LASTEXITCODE
$env:PGPASSWORD = $null

if ($code -ne 0) {
  Write-Error "Failed: $out"
  exit 1
}
Write-Host 'postgres superuser password changed successfully.'
Write-Host 'NOTE: if you typed the CURRENT password wrong above, the change did not happen.'

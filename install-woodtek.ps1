# ============================================================================
# WoodTek ERP - one-command home installer
# ----------------------------------------------------------------------------
# Sets up a fresh, self-contained WoodTek ERP on this PC and runs it as a host
# (auto-starts at boot, no console window).
#
#   HOW TO RUN (from the folder where you extracted the zip):
#     powershell -ExecutionPolicy Bypass -File .\install-woodtek.ps1
#
# What it does, in order:
#   1. checks Node.js (tries winget if missing)
#   2. checks PostgreSQL/psql (tries winget if missing)
#   3. npm install
#   4. writes .env (prompts for DB details, generates AUTH_SECRET)
#   5. creates the database role + database if they do not exist
#   6. builds the schema (drizzle-kit push) + applies routing recipes + PIMS map
#   7. builds the production bundle
#   8. registers "WoodTek ERP" as a boot auto-start task (runs as SYSTEM)
#   9. starts the server and opens the browser
# ============================================================================
$ErrorActionPreference = 'Stop'

# --- admin check (needed for the SYSTEM boot task) --------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'This installer needs administrator rights (to register the auto-start task).' -ForegroundColor Yellow
  Write-Host 'Requesting elevation...'
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $appRoot

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  WoodTek ERP - Home Installer' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host "  App folder: $appRoot"
Write-Host ''

# --- 1. Node.js -------------------------------------------------------------
Write-Host '[1/9] Checking Node.js...' -ForegroundColor Yellow
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) {
  Write-Host '  Node.js not found. Trying winget...'
  try {
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  } catch { }
  if (-not $node) {
    Write-Host '  Could not install Node.js automatically.' -ForegroundColor Red
    Write-Host '  Install it from https://nodejs.org (LTS), then re-run this script.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
  }
}
Write-Host '  Node.js OK' -ForegroundColor Green

# --- 2. PostgreSQL ----------------------------------------------------------
Write-Host '[2/9] Checking PostgreSQL...' -ForegroundColor Yellow
$psql = Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) { $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source }
if (-not $psql) {
  Write-Host '  PostgreSQL not found. Trying winget...'
  try { winget install -e --id PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --accept-source-agreements | Out-Null } catch { }
  try { winget install -e --id PostgreSQL.PostgreSQL --silent --accept-package-agreements --accept-source-agreements | Out-Null } catch { }
  $psql = Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
          Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
  Write-Host '  Could not install PostgreSQL automatically.' -ForegroundColor Red
  Write-Host '  Install it from https://www.postgresql.org/download/windows/ (remember the' -ForegroundColor Red
  Write-Host '  superuser password you set), then re-run this script.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}
Write-Host '  PostgreSQL OK' -ForegroundColor Green

# --- 3. npm install ---------------------------------------------------------
Write-Host '[3/9] Installing app dependencies (npm install)...' -ForegroundColor Yellow
cmd /c "npm install --no-audit --no-fund"
if ($LASTEXITCODE -ne 0) { Write-Host '  npm install failed.' -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }
Write-Host '  Dependencies OK' -ForegroundColor Green

# --- 4. .env ----------------------------------------------------------------
Write-Host '[4/9] Database connection settings' -ForegroundColor Yellow
$dbHost = Read-Host '  DB host (Enter for 127.0.0.1)'; if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = '127.0.0.1' }
$dbPort = Read-Host '  DB port (Enter for 5432)';       if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = '5432' }
$dbUser = Read-Host '  DB user (Enter for woodtek_owner)'; if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = 'woodtek_owner' }
$dbPass = Read-Host '  DB password (Enter for 1234)';   if ($dbPass -eq '') { $dbPass = '1234' }
$dbName = Read-Host '  DB name (Enter for woodtek_factory)'; if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'woodtek_factory' }
$demo = Read-Host '  Load demo data? (y/N)'; if ($demo -eq 'y' -or $demo -eq 'Y') { $demoMode = 'on' } else { $demoMode = 'off' }

$bytes = New-Object byte[] 48
(New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })

$envFile = Join-Path $appRoot '.env'
$envContent = @"
DATABASE_URL=postgres://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}
AUTH_SECRET=$secret
AUTH_COOKIE_SECURE=false
NEXT_PUBLIC_WOODTEK_DEMO=$demoMode
"@
Set-Content -Path $envFile -Value $envContent -Encoding Ascii
Write-Host '  .env written' -ForegroundColor Green

# --- 5. database + role -----------------------------------------------------
Write-Host '[5/9] Creating database role and database...' -ForegroundColor Yellow
$pgSuperPass = Read-Host '  Postgres SUPERUSER password (the one set during PostgreSQL install)'
$env:PGPASSWORD = $pgSuperPass

$roleExists = (& $psql -h $dbHost -p $dbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$dbUser';" 2>$null) -match '1'
if (-not $roleExists) {
  $escPass = $dbPass.Replace("'", "''")
  & $psql -h $dbHost -p $dbPort -U postgres -d postgres -c "CREATE ROLE $dbUser LOGIN PASSWORD '$escPass';" | Out-Null
  Write-Host "  Created role $dbUser" -ForegroundColor Green
} else {
  Write-Host "  Role $dbUser already exists" -ForegroundColor Green
}

$dbExists = (& $psql -h $dbHost -p $dbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName';" 2>$null) -match '1'
if (-not $dbExists) {
  & $psql -h $dbHost -p $dbPort -U postgres -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser;" | Out-Null
  Write-Host "  Created database $dbName" -ForegroundColor Green
} else {
  Write-Host "  Database $dbName already exists" -ForegroundColor Green
}
$env:PGPASSWORD = $null

# --- 6. schema + recipes + PIMS map -----------------------------------------
Write-Host '[6/9] Building schema and routing data...' -ForegroundColor Yellow
cmd /c "npx drizzle-kit push"
if ($LASTEXITCODE -ne 0) { Write-Host '  Schema build failed.' -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }

$env:PGPASSWORD = $dbPass
& $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $appRoot 'drizzle\0005_order_routing.sql') | Out-Null
& $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $appRoot 'drizzle\0006_pims_bridge.sql') | Out-Null
$env:PGPASSWORD = $null
Write-Host '  Schema + recipes + PIMS map OK' -ForegroundColor Green

# --- 7. production build ----------------------------------------------------
Write-Host '[7/9] Building production bundle (a few minutes)...' -ForegroundColor Yellow
cmd /c "node scripts\build-prod.cjs"
if ($LASTEXITCODE -ne 0) { Write-Host '  Build failed.' -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }
Write-Host '  Build OK' -ForegroundColor Green

# --- 8. auto-start task (run as a host) -------------------------------------
Write-Host '[8/9] Registering auto-start task (runs at boot as SYSTEM)...' -ForegroundColor Yellow
$silentBat = Join-Path $appRoot 'start-woodtek-prod-silent.bat'
schtasks /Create /TN "WoodTek ERP" /TR "`"$silentBat`"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F | Out-Null
Write-Host '  Auto-start task registered' -ForegroundColor Green

# --- 9. start + open browser ------------------------------------------------
Write-Host '[9/9] Starting WoodTek ERP...' -ForegroundColor Yellow
schtasks /Run /TN "WoodTek ERP" | Out-Null
Write-Host '  Waiting for the server to come up...'
Start-Sleep -Seconds 15
Start-Process 'http://localhost:3000'

Write-Host ''
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host '  WoodTek ERP is installed and running!' -ForegroundColor Green
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host "  Open:        http://localhost:3000"
Write-Host "  Health:      http://localhost:3000/api/health"
Write-Host '  Day-to-day:  powershell -File woodtek-ctl.ps1 start|stop|status|backup|open'
Write-Host '  Uninstall:   schtasks /Delete /TN "WoodTek ERP" /F'
Write-Host ''
Write-Host '  If this is a brand-new database, sign in and create the Owner account,'
Write-Host '  or load demo data (Manager PIN 1001) if you chose demo mode.'
Write-Host ''
Read-Host 'Press Enter to finish'

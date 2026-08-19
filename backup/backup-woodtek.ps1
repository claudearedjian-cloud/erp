# ============================================================================
# WoodTek ERP — nightly database backup
# ----------------------------------------------------------------------------
# Dumps woodtek_factory (Postgres custom format, -Fc) into backup\ and keeps
# the newest 14 dumps. Reads the connection details from the app's .env so
# there is a single source of truth (no passwords duplicated here).
#
# Run manually:  powershell -ExecutionPolicy Bypass -File backup\backup-woodtek.ps1
# Or schedule:   ops\install-autostart.ps1 also registers a nightly backup task.
# ============================================================================
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path        # ...\backup
$appRoot = Split-Path -Parent $root                            # ...\woodtek-erp
$envFile = Join-Path $appRoot '.env'

# ---- resolve connection from .env (fallback to local defaults) --------------
$url = $null
if (Test-Path $envFile) {
  $m = Select-String -Path $envFile -Pattern '^\s*DATABASE_URL\s*=\s*(\S+)' -ErrorAction SilentlyContinue
  if ($m) { $url = $m.Matches[0].Groups[1].Value.Trim() }
}
if (-not $url) { $url = 'postgres://woodtek_owner:1234@127.0.0.1:5432/woodtek_factory' }

$u = [Uri]$url
$dbUser = [Uri]::UnescapeDataString($u.UserInfo.Split(':')[0])
$dbPass = [Uri]::UnescapeDataString($u.UserInfo.Split(':')[1])
$dbHost = $u.Host
$dbPort = if ($u.Port -gt 0) { $u.Port } else { 5432 }
$dbName = $u.AbsolutePath.TrimStart('/')

# ---- locate pg_dump ---------------------------------------------------------
$pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter pg_dump.exe -ErrorAction SilentlyContinue |
          Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $pgDump) { $pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source }
if (-not $pgDump) { Write-Error 'pg_dump.exe not found.'; exit 1 }

$backupDir = Join-Path $appRoot 'backup'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$file  = Join-Path $backupDir "woodtek_factory_$stamp.dump"
$logFile = Join-Path $backupDir 'backup.log'

# ---- dump -------------------------------------------------------------------
$env:PGPASSWORD = $dbPass
& $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -Fc -f $file 2>&1 | Out-Null
$code = $LASTEXITCODE
$env:PGPASSWORD = $null

if ($code -ne 0) {
  "$stamp  BACKUP FAILED (exit $code)" | Out-File -FilePath $logFile -Append -Encoding utf8
  Write-Error 'Backup failed — see backup\backup.log'
  exit 1
}

# ---- rotate: keep the newest 14 dumps --------------------------------------
Get-ChildItem $backupDir -Filter '*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  Remove-Item -Force -ErrorAction SilentlyContinue

$size = (Get-Item $file).Length
"$stamp  BACKUP OK  $file  ($size bytes)" | Out-File -FilePath $logFile -Append -Encoding utf8
Write-Host "Backup complete: $file ($size bytes)"

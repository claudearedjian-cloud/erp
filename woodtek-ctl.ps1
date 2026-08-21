# ============================================================================
# WoodTek ERP - day-to-day control script
# ----------------------------------------------------------------------------
#   powershell -File .\woodtek-ctl.ps1 start     - start the server (background)
#   powershell -File .\woodtek-ctl.ps1 stop      - stop the server
#   powershell -File .\woodtek-ctl.ps1 status    - is it running?
#   powershell -File .\woodtek-ctl.ps1 open      - open the app in the browser
#   powershell -File .\woodtek-ctl.ps1 backup    - dump the database now
#   powershell -File .\woodtek-ctl.ps1 log       - show recent server log lines
# ============================================================================
param([string]$Action = 'status')

$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$task = 'WoodTek ERP'

switch ($Action.ToLower()) {
  'start' {
    schtasks /Run /TN $task | Out-Null
    Start-Sleep -Seconds 3
    Write-Host 'Started. Health check:'
    try { (Invoke-RestMethod 'http://localhost:3000/api/health') | Format-List } catch { Write-Host 'Not ready yet - wait a few seconds and try again.' }
  }
  'stop' {
    schtasks /End /TN $task | Out-Null
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host 'Stopped.'
  }
  'status' {
    try {
      $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 5
      Write-Host "RUNNING - health says: $($r.ok)" -ForegroundColor Green
    } catch {
      Write-Host 'NOT RUNNING (no response on port 3000)' -ForegroundColor Red
    }
  }
  'open' {
    Start-Process 'http://localhost:3000'
  }
  'backup' {
    $b = Join-Path $appRoot 'backup\backup-woodtek.ps1'
    if (Test-Path $b) { powershell -NoProfile -ExecutionPolicy Bypass -File $b }
    else { Write-Host 'backup\backup-woodtek.ps1 not found.' }
  }
  'log' {
    $log = Join-Path $appRoot 'logs\woodtek.log'
    if (Test-Path $log) { Get-Content $log -Tail 30 }
    else { Write-Host 'No log file yet (logs\woodtek.log appears once the server has run).' }
  }
  default {
    Write-Host 'Usage: powershell -File .\woodtek-ctl.ps1 [start|stop|status|open|backup|log]'
  }
}

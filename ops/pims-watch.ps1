# ============================================================================
# WoodTek ERP - PIMS folder watcher (OPTIONAL)
# ----------------------------------------------------------------------------
# Reads each new *.xml invoice from the PIMS export folder and POSTs it to the
# running WoodTek ERP for import. Processed files are moved to a "processed"
# subfolder so they are never sent twice. Idempotent - safe to run often.
#
# Two ways to use it:
#   1. On demand:   powershell -ExecutionPolicy Bypass -File ops\pims-watch.ps1
#   2. Automatically every few minutes (as Administrator):
#        schtasks /Create /TN "WoodTek PIMS Watch" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\woodtek-erp\woodtek-erp\ops\pims-watch.ps1" /SC MINUTE /MO 2 /RU SYSTEM /F
#
# The folder path is read from the ERP's own settings (configured in the
# PIMS Import screen), so there is a single source of truth.
# ============================================================================
$ErrorActionPreference = 'SilentlyContinue'

$opsDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $opsDir
$errpUrl = 'http://127.0.0.1:3000'

# Use the app's own scan endpoint (it reads the folder path from settings).
try {
  $r = Invoke-RestMethod -Method Post -Uri "$errpUrl/api/pims/scan" -TimeoutSec 120
  Write-Host "PIMS scan complete: $($r.scanned) file(s) checked."
} catch {
  Write-Host "PIMS scan failed: $_"
}

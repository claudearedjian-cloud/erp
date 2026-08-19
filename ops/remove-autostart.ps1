# Remove the WoodTek ERP scheduled tasks.
# Usage:  powershell -ExecutionPolicy Bypass -File ops\remove-autostart.ps1
schtasks /Delete /TN "WoodTek ERP" /F
schtasks /Delete /TN "WoodTek ERP Backup" /F
Write-Host 'Removed WoodTek ERP scheduled tasks.'

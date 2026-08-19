# ============================================================================
# WoodTek ERP — RUNNING IN PRODUCTION (hardening runbook)
# ============================================================================
#
# What changed vs. the old "npx next dev" workflow:
#   * `next dev`  ->  production build + standalone server  (faster, stable,
#     no dev overlays; this is what a real install runs)
#   * sessions survive restarts (persistent AUTH_SECRET)
#   * database superuser password no longer "1234"
#   * automatic nightly backups with rotation
#   * optional: auto-start on boot / run as a Windows service
#
# Do these once, in order. All commands are Windows PowerShell.
# ----------------------------------------------------------------------------

## 1. Set a persistent AUTH_SECRET  (fixes everyone being logged out on restart)
powershell -ExecutionPolicy Bypass -File ops\set-auth-secret.ps1

## 2. Change the postgres superuser password off "1234"
powershell -ExecutionPolicy Bypass -File ops\change-postgres-password.ps1
# (This does NOT affect the app — the app logs in as woodtek_owner.)
# Optional extra hardening: also rotate woodtek_owner's password AND update it
# in .env's DATABASE_URL, then restart the app. Ask if you want to do this.

## 3. Build the production bundle  (one-time, and again after any code update)
build-woodtek-prod.bat        # or:  node scripts\build-prod.cjs

## 4. Start the app in production mode
start-woodtek-prod.bat        # double-click; opens the browser when ready
# Keep the old  start-woodtek-dev-lan.bat  only for development work.

## 5. First backup + verify restore works
powershell -ExecutionPolicy Bypass -File backup\backup-woodtek.ps1
# Test restoring (creates a throwaway copy): see "Restore" below.

## 6. (Recommended) Auto-start on boot + nightly backup
powershell -ExecutionPolicy Bypass -File ops\install-autostart.ps1     # admin PowerShell
#   * starts the server at boot (before login, no window)
#   * backs up the database every night at 02:30
# Remove:  powershell -ExecutionPolicy Bypass -File ops\remove-autostart.ps1

## 6b. (Optional, alternative) Run as a Windows service via NSSM
powershell -ExecutionPolicy Bypass -File ops\install-service-nssm.ps1  # admin PowerShell
# Requires nssm.exe (https://nssm.cc/download). Pick EITHER 6 or 6b.

# ----------------------------------------------------------------------------
# DAY-TO-DAY
# ----------------------------------------------------------------------------
#   Check it's alive:      http://localhost:3000/api/health   -> {"ok":true}
#   Logs:                  logs\woodtek.log  (when running via scheduled task/service)
#   Backups live in:       backup\woodtek_factory_YYYYMMDD_HHMMSS.dump
#   Latest backup log:     backup\backup.log

# ----------------------------------------------------------------------------
# RESTORE FROM A BACKUP (custom format, -Fc)
# ----------------------------------------------------------------------------
# 1. Stop the app.
# 2. Restore into a NEW database to verify, or overwrite the live one:
#
#    # Verify into a copy (safe):
#    & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h 127.0.0.1 -U postgres -C -d postgres backup\woodtek_factory_YYYYMMDD_HHMMSS.dump
#    #   (the -C flag recreates the database; use -c --if-exists instead to overwrite an existing one)
#
# 3. Restart the app.

# ----------------------------------------------------------------------------
# ROLL BACK to development mode
# ----------------------------------------------------------------------------
#   Stop the production server (close the window / disable the task / stop the service)
#   and double-click  start-woodtek-dev-lan.bat  as before.

# ----------------------------------------------------------------------------
# TROUBLESHOOTING
# ----------------------------------------------------------------------------
#   "DATABASE_URL is not set"           -> create .env from .env.example
#   "production build not found"        -> run build-woodtek-prod.bat first
#   Clients on LAN can't reach the app  -> allow TCP 3000 in Windows Firewall:
#       netsh advfirewall firewall add rule name="WoodTek ERP" dir=in action=allow protocol=TCP localport=3000
#   Backup task fails                   -> read backup\backup.log
#   App won't start at boot             -> schtasks /Query /TN "WoodTek ERP"  (and check logs\woodtek.log)
# ============================================================================

================================================================================
 WoodTek ERP - HOME INSTALL KIT (trial / test machine)
================================================================================

WHAT THIS IS
------------
A complete, self-contained copy of WoodTek ERP that installs on a Windows PC
with ONE command and runs as a background host (starts automatically at boot).

WHAT YOU NEED (prerequisites)
-----------------------------
1. Windows 10 or 11, 64-bit.
2. Internet access the first time (to download Node.js / PostgreSQL / npm
   packages). The installer will try to install Node.js and PostgreSQL for you
   via winget if they are missing. If that fails, install them manually:
     - Node.js LTS:  https://nodejs.org
     - PostgreSQL:   https://www.postgresql.org/download/windows/
       (during PostgreSQL setup you will be asked to set a SUPERUSER password
       - remember it, the installer asks for it to create the app database)

ONE-COMMAND INSTALL
-------------------
1. Extract this zip somewhere permanent, for example:
       C:\WoodTek
   (do NOT install inside OneDrive or a synced folder).

2. Open PowerShell IN that folder and run:
       powershell -ExecutionPolicy Bypass -File .\install-woodtek.ps1

3. Answer the prompts (press Enter to accept the defaults shown):
       DB host        -> 127.0.0.1
       DB port        -> 5432
       DB user        -> woodtek_owner
       DB password    -> 1234
       DB name        -> woodtek_factory
       Load demo data -> y   (recommended for trials)
       Postgres SUPERUSER password -> the one from the PostgreSQL installer

4. Wait. The installer: npm-installs dependencies, creates the database,
   builds the schema, applies routing recipes + PIMS map, builds the
   production bundle, registers the auto-start task, and launches the app.

5. A browser opens to http://localhost:3000.
   - If you chose demo data: sign in as "Marcus Vance" (Manager), PIN 1001.
     Other demo PINs: Elena 2002, Diego 3003, Sales 4004, QA 5005, Tech 6006.
   - If you did not: create the Owner account on the first-run screen.

DAY-TO-DAY
----------
   powershell -File .\woodtek-ctl.ps1 status    is it running?
   powershell -File .\woodtek-ctl.ps1 start     start it
   powershell -File .\woodtek-ctl.ps1 stop      stop it
   powershell -File .\woodtek-ctl.ps1 open      open in browser
   powershell -File .\woodtek-ctl.ps1 backup    dump the database now
   powershell -File .\woodtek-ctl.ps1 log       show recent server log

   The server runs as a Windows task "WoodTek ERP" and starts on every boot.
   Check it at any time:  http://localhost:3000/api/health  -> {"ok":true}

UNINSTALL
---------
   schtasks /Delete /TN "WoodTek ERP" /F
   (then delete this folder, and drop the database if you want)

NOTES
-----
- This is a FRESH, EMPTY installation - it does not touch your work PC.
- The database lives inside PostgreSQL, NOT in this folder.
- Backups (if you run the backup command) are stored in  backup\  and are
  dumps of woodtek_factory.
- Keep the .env file private - it contains the database password.
================================================================================

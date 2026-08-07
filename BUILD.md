# Building the WoodTek ERP Windows installer

This document explains how to produce a single `WoodTekERP-Setup.exe` that
end-users can run to install the app on any Windows machine.

## What you get

After the build, you'll find in `dist/`:

| File | Purpose |
| --- | --- |
| `WoodTekERP-portable.exe` | The standalone app, ~80 MB. No install needed. |
| `WoodTekERP-Setup-1.0.0.exe` | Real Windows installer with welcome page, EULA, install path picker, desktop shortcut. ~85 MB. |

Both work the same way for the end user: double-click, the app starts in
their browser.

## One-time setup on the build machine

You need:

1. **Windows 10 or 11** (the build can only run on Windows)
2. **Node.js 18+** (you already have this)
3. **Inno Setup 6** (free) — download from https://jrsoftware.org/isdl.php
4. **~5 GB free disk space** (for the build intermediates)

## Build steps

Open `cmd` as Administrator and run:

```cmd
cd /d C:\woodtek-erp
git pull origin main
npm install
```

This pulls the latest code from GitHub and installs dependencies.

### Step 1: Build the production Next.js bundle

```cmd
npm run build
```

This creates `.next/standalone/` — a minimal, self-contained copy of the app.

### Step 2: Build the portable .exe

```cmd
npm run build:portable
```

This downloads `pkg`, bundles the standalone output + a Node.js runtime into
`dist/WoodTekERP-portable.exe`. Takes 2-5 minutes on first run.

**Test it:** double-click `dist\WoodTekERP-portable.exe` — a console window
should open, ask for the database connection the first time, and launch the
app in your browser.

### Step 3: Build the Windows installer

```cmd
npm run build:installer
```

This generates `dist\woodtek-erp.iss` and calls Inno Setup to compile it
into `dist\WoodTekERP-Setup-1.0.0.exe`. Takes 1-2 minutes.

The installer has:
- Welcome page with the WoodTek ERP name
- License agreement (LICENSE.txt)
- Install path picker (default: `C:\Program Files\WoodTekERP`)
- "Create desktop shortcut" checkbox
- "Create Start Menu shortcut" checkbox
- Finish page with "Launch WoodTek ERP" option

### Step 4: Distribute

Email the `WoodTekERP-Setup-1.0.0.exe` to your team. Each user double-clicks
it, the installer runs, and the app is installed in under a minute.

## End-user experience (after install)

1. User double-clicks the desktop shortcut `WoodTek ERP`
2. A console window opens (this is the launcher; can be hidden in a future version)
3. **First run only:** the launcher asks for:
   - Database host (default: 127.0.0.1)
   - Database port (default: 5432)
   - Database user (default: woodtek_owner)
   - Database password
   - Database name (default: woodtek_factory)
4. The launcher writes `%APPDATA%\WoodTekERP\.env` and starts the app
5. The browser opens to `http://localhost:3000`
6. User signs in with their PIN
7. **Subsequent runs:** the launcher just starts the app — no questions asked

To reconfigure the database, the user deletes
`%APPDATA%\WoodTekERP\.env` and runs the launcher again.

## Customizing the installer

### Adding your logo
Save your icon as `assets\woodtek-icon.ico` (256x256 ICO format). It's used
as the installer icon and the app shortcut icon.

### Changing the app name
Edit `scripts/build-installer.js`:
```js
const APP_NAME = "WoodTek ERP";
```

### Adding an uninstaller for PostgreSQL
Add a `[Run]` section in the generated `.iss` file that runs your
`postgresql-installer.exe`. Save the installer as
`assets\postgresql-installer.exe` and uncomment the corresponding `[Files]`
entry in `build-installer.js`.

## Troubleshooting

### `npm run build:portable` fails with "no Python"
Some `pkg` builds need Python to compile native modules. Install Python 3
from https://www.python.org/ and re-run.

### The .exe is huge
The first build downloads Node.js binaries (~30 MB) and the Next.js
production output. Subsequent builds are faster and use cached assets.

### "libcrypto-1_1-x64.dll not found" at runtime
The bundled Node.js is missing the OpenSSL libraries. The
`pg` package needs them. Reinstall the build:
```cmd
npm run build:portable
```

### App starts but database connection fails
Check `%APPDATA%\WoodTekERP\.env` — the URL must be valid. Common issues:
- Wrong host (try `localhost` instead of `127.0.0.1` or vice-versa)
- Wrong port (default is 5432)
- PostgreSQL not listening on that interface
- Firewall blocking port 5432

## Updating to a new version

1. `git pull origin main`
2. `npm install` (in case dependencies changed)
3. `npm run build:portable`
4. `npm run build:installer`
5. Distribute the new `WoodTekERP-Setup-1.0.1.exe`

Each user's existing `%APPDATA%\WoodTekERP\.env` is preserved across updates
(unless they uninstall first).

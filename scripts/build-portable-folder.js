// scripts/build-portable-folder.js
// ============================================================================
// WoodTek ERP - portable FOLDER builder (reliable alternative to pkg)
// ----------------------------------------------------------------------------
// pkg cannot resolve Next.js 16's ESM imports of externalized packages (pg),
// so the single-exe route is a dead end. This builder produces a portable
// FOLDER that runs with the REAL Node.js runtime (no pkg), which works:
//
//   dist/WoodTekERP-portable/
//     node.exe                <- copied from the installed Node (portable runtime)
//     server.js               <- Next standalone server
//     .next/                  <- static + server chunks
//     node_modules/           <- real modules (pg, bcryptjs, next runtime)
//     Start-WoodTek.bat       <- double-click to run
//
// Usage:  node scripts/build-portable-folder.js
// ============================================================================

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const OUT = path.join(DIST, "WoodTekERP-portable");

function log(msg) { console.log(`\n\x1b[36m[portable-folder]\x1b[0m ${msg}`); }
function run(cmd) { log(`> ${cmd}`); execSync(cmd, { stdio: "inherit", cwd: ROOT }); }
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function main() {
  log("=== WoodTek ERP portable folder build ===\n");

  // 1. Build the Next.js production bundle (webpack for stable externals)
  log("Step 1/4: Building Next.js production bundle (webpack)...");
  rmrf(path.join(ROOT, ".next"));
  run("npx next build --webpack");

  if (!fs.existsSync(STANDALONE)) {
    throw new Error(`Expected standalone build at ${STANDALONE} but it does not exist.`);
  }

  // 2. Clear + create output folder
  log("Step 2/4: Preparing output folder...");
  rmrf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  // 3. Copy standalone output + static + public
  log("Step 3/4: Assembling portable folder...");
  copyDir(STANDALONE, OUT);

  const nextStatic = path.join(ROOT, ".next", "static");
  if (fs.existsSync(nextStatic)) copyDir(nextStatic, path.join(OUT, ".next", "static"));

  const publicSrc = path.join(ROOT, "public");
  if (fs.existsSync(publicSrc)) copyDir(publicSrc, path.join(OUT, "public"));

  // Copy the server folder too (some chunks live there)
  const nextServer = path.join(ROOT, ".next", "server");
  if (fs.existsSync(nextServer)) {
    const dest = path.join(OUT, ".next", "server");
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(nextServer)) {
      const s = path.join(nextServer, entry);
      const d = path.join(dest, entry);
      if (!fs.existsSync(d)) {
        if (fs.statSync(s).isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
      }
    }
  }

  // 4. Ensure pg + bcryptjs are in node_modules (the standalone output omits
  //    externals). Copy them from the project node_modules.
  const externals = ["pg", "bcryptjs", "pg-connection-string", "pg-pool", "pg-protocol", "pg-types", "pgpass", "pg-int8", "postgres-array", "postgres-bytea", "postgres-date", "postgres-interval", "split2", "obuf", "buffer-writer", "packet-reader", "xtend"];
  for (const pkgName of externals) {
    const src = path.join(ROOT, "node_modules", pkgName);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(OUT, "node_modules", pkgName));
    }
  }

  // 5. Copy portable Node.exe (the runtime that runs the server)
  log("Step 4/4: Copying portable Node runtime...");
  const nodeExe = process.execPath; // the Node.exe currently running this script
  fs.copyFileSync(nodeExe, path.join(OUT, "node.exe"));

  // 6. Write the Start-WoodTek.bat launcher
  log("Writing Start-WoodTek.bat...");
  const bat = `@echo off
setlocal
title WoodTek ERP - Portable
cd /d "%~dp0"

REM Use the bundled portable Node if present
set "NODE=%~dp0node.exe"
if not exist "%NODE%" set "NODE=node"

echo.
echo  ============================================================
echo    WoodTek ERP - Portable  (local server)
echo  ============================================================
echo  Starting on http://localhost:3000 ...
echo  Press Ctrl+C to stop.
echo  ============================================================
echo.

REM Copy .env from this folder if present (server reads it from cwd)
if exist ".env" (
  echo Using .env from this folder.
)

REM Open the browser (start the server in the background first)
start "" "http://localhost:3000"

"%NODE%" server.js

pause
`;
  fs.writeFileSync(path.join(OUT, "Start-WoodTek.bat"), bat);

  // Also copy .env if one exists in the project root (convenience)
  if (fs.existsSync(path.join(ROOT, ".env"))) {
    fs.copyFileSync(path.join(ROOT, ".env"), path.join(OUT, ".env"));
  }

  const sizeMB = (fs.statSync(path.join(OUT, "node.exe")).size / 1024 / 1024).toFixed(1);
  log(`\\n=== Build complete ===`);
  log(`Output: ${OUT}`);
  log(`Portable Node: ${sizeMB} MB`);
  log(`\\nDistribute this FOLDER. Users double-click Start-WoodTek.bat`);
}

main().catch((err) => {
  console.error("\n\x1b[31m[portable-folder] FAILED:\x1b[0m", err.message);
  process.exit(1);
});

// scripts/build-portable.js
// ============================================================================
// WoodTek ERP - portable .exe builder
// ----------------------------------------------------------------------------
// Bundles the Next.js production build + a Node.js runtime into a single
// Windows .exe using `pkg`. The resulting file is fully portable:
//   - No installation required
//   - First run prompts for DB connection, then starts the app
//   - Subsequent runs just open the browser to the running app
//
// Usage (on a Windows machine with Node.js installed):
//   npm install
//   npm run build            # builds the Next.js app
//   npm run build:portable   # creates dist/WoodTekERP-portable.exe
// ============================================================================

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const PORTABLE_EXE = path.join(DIST, "WoodTekERP-portable.exe");

function log(msg) {
  console.log(`\n\x1b[36m[build-portable]\x1b[0m ${msg}`);
}

function run(cmd, opts = {}) {
  log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function rmrf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

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
  log("=== WoodTek ERP portable build ===\n");

  // 1. Ensure Next.js standalone output exists
  log("Step 1/4: Building Next.js production bundle...");
  rmrf(path.join(ROOT, ".next"));
  run("npx next build");

  if (!fs.existsSync(STANDALONE)) {
    throw new Error(
      `Expected standalone build at ${STANDALONE} but it does not exist.\n` +
      `Make sure next.config.js has:  output: "standalone"`,
    );
  }

  // 2. Prepare dist/
  log("Step 2/4: Preparing dist/ folder...");
  rmrf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  // 3. Copy standalone output into a working folder, with a launcher script
  log("Step 3/4: Assembling portable package...");
  const pkgDir = path.join(DIST, "_pkg");
  rmrf(pkgDir);
  copyDir(STANDALONE, pkgDir);
  copyDir(path.join(ROOT, ".next", "static"), path.join(pkgDir, ".next", "static"));

  // Copy the runtime entry we ship with the .exe
  fs.copyFileSync(
    path.join(__dirname, "..", "portable-launcher.cjs"),
    path.join(pkgDir, "portable-launcher.cjs"),
  );
  fs.copyFileSync(
    path.join(__dirname, "..", "portable-package.json"),
    path.join(pkgDir, "package.json"),
  );

  // 4. Use pkg to bundle everything into a single .exe
  log("Step 4/4: Bundling into a single .exe (this takes a few minutes)...");
  // --targets node18-win-x64 produces a 64-bit Windows executable
  // --output writes to the path we want
  const pkgTargets = "node18-win-x64";
  run(
    `npx --yes pkg "${path.join(pkgDir, "portable-launcher.cjs")}" --targets ${pkgTargets} --output "${PORTABLE_EXE}"`,
    { cwd: ROOT },
  );

  if (!fs.existsSync(PORTABLE_EXE)) {
    throw new Error("pkg did not produce the expected output file");
  }

  const sizeMB = (fs.statSync(PORTABLE_EXE).size / 1024 / 1024).toFixed(1);
  log(`\n=== Build complete ===`);
  log(`Output: ${PORTABLE_EXE}`);
  log(`Size:   ${sizeMB} MB`);
  log(`\nDistribute this single file. Recipients just double-click it.`);
}

main().catch((err) => {
  console.error("\n\x1b[31m[build-portable] FAILED:\x1b[0m", err.message);
  process.exit(1);
});

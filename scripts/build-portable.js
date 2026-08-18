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
  // fs.cpSync handles symlinks/junctions and long paths robustly on Windows.
  // fs.copyFileSync fails with EPERM "operation not permitted" when it
  // encounters a symlink/junction (common inside .next/standalone/node_modules).
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: true });
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

  // Standalone output omits the .next/static folder. Copy it back in.
  const nextStaticSrc = path.join(ROOT, ".next", "static");
  if (fs.existsSync(nextStaticSrc)) {
    copyDir(nextStaticSrc, path.join(pkgDir, ".next", "static"));
  }

  // Standalone output omits the public folder. Copy it back in.
  const publicSrc = path.join(ROOT, "public");
  if (fs.existsSync(publicSrc)) {
    copyDir(publicSrc, path.join(pkgDir, "public"));
  }

  // Some Next.js 16 standalone builds also need the .next/server folder copied
  // in full. Copy anything in .next that isn't already present.
  const nextServerSrc = path.join(ROOT, ".next", "server");
  if (fs.existsSync(nextServerSrc)) {
    const pkgNextServer = path.join(pkgDir, ".next", "server");
    fs.mkdirSync(pkgNextServer, { recursive: true });
    for (const entry of fs.readdirSync(nextServerSrc)) {
      const s = path.join(nextServerSrc, entry);
      const d = path.join(pkgNextServer, entry);
      if (!fs.existsSync(d)) {
        try {
          if (fs.statSync(s).isDirectory()) copyDir(s, d);
          else fs.copyFileSync(s, d);
        } catch (err) {
          log(`  (skipped ${entry}: ${err.code || err.message})`);
        }
      }
    }
  }

  // The Next.js standalone server.js calls process.chdir(__dirname) on boot.
  // Inside pkg the bundle lives in a virtual snapshot dir (C:\snapshot\_pkg)
  // that cannot be chdir'd to, which crashes the exe. Patch the generated
  // server.js so it chdirs to a real directory instead (the app-data dir,
  // falling back to the current working directory).
  const serverJs = path.join(pkgDir, "server.js");
  if (fs.existsSync(serverJs)) {
    const orig = fs.readFileSync(serverJs, "utf8");
    const patched = orig
      .replace(
        "process.chdir(__dirname)",
        "try { process.chdir(process.env.APPDATA || process.cwd()); } catch (e) {}",
      )
      .replace(
        "process.chdir(__dirname );",
        "try { process.chdir(process.env.APPDATA || process.cwd()); } catch (e) {}",
      );
    if (patched !== orig) {
      fs.writeFileSync(serverJs, patched);
      log("Patched server.js chdir for pkg snapshot compatibility");
    }
  }

  // pkg cannot provide the node:inspector builtin (ERR_INSPECTOR_NOT_AVAILABLE).
  // Next's require-hook.js is the single interception point through which the
  // failing require flows, so we short-circuit any 'node:inspector'/'inspector'
  // request there and return a harmless stub (inspector is dev-only).
  const requireHook = path.join(pkgDir, "node_modules", "next", "dist", "server", "require-hook.js");
  if (fs.existsSync(requireHook)) {
    const hookSrc = fs.readFileSync(requireHook, "utf8");
    const guard =
      "  if (request === 'node:inspector' || request === 'inspector') {\n" +
      "    return { Session: class {}, close() {}, open() {}, url() { return undefined; }, waitForDebugger() {} };\n" +
      "  }\n";
    const patchedHook = hookSrc.replace(
      "  return originalRequire.call(this, request);",
      guard + "  return originalRequire.call(this, request);",
    );
    if (patchedHook !== hookSrc) {
      fs.writeFileSync(requireHook, patchedHook);
      log("Patched next require-hook.js (intercepted node:inspector for pkg)");
    } else {
      log("WARN: require-hook.js pattern not found - inspector stub may not apply");
    }
  }

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
  // Use the maintained pkg fork (@yao-pkg/pkg) with Node 22. The original
  // pkg (5.8.1) is deprecated and its bundled Node 18 chokes on next's
  // require of node:inspector; Node 22 handles it natively.
  const pkgTargets = "node22-win-x64";

  // pkg only bundles code reachable from the launcher entry. The standalone
  // server.js (spawned at runtime) needs the full next runtime from
  // node_modules, so we ship the standalone node_modules as pkg assets.
  // The snapshot path is C:\snapshot\_pkg (mirrors pkgDir at runtime).
  const pkgConfigPath = path.join(pkgDir, "pkg-config.json");
  const nodeModulesRel = "node_modules";
  fs.writeFileSync(
    pkgConfigPath,
    JSON.stringify(
      {
        pkg: {
          assets: [
            `${nodeModulesRel}/**/*`,
            ".next/**/*",
            "public/**/*",
          ],
          scripts: [],
        },
      },
      null,
      2,
    ),
  );

  run(
    `npx --yes @yao-pkg/pkg "${path.join(pkgDir, "portable-launcher.cjs")}" --config "${pkgConfigPath}" --targets ${pkgTargets} --output "${PORTABLE_EXE}"`,
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

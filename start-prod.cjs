#!/usr/bin/env node
// ============================================================================
// WoodTek ERP — production launcher (watchdog + browser auto-open)
// ----------------------------------------------------------------------------
// Loads .env from the app folder, runs the Next.js standalone production
// server, restarts it automatically if it crashes, and opens the browser
// once the server reports healthy.
//
//   node start-prod.cjs               # interactive (opens browser)
//   node start-prod.cjs --no-browser  # for scheduled tasks / services
// ============================================================================

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname);
const STANDALONE = path.join(ROOT, ".next", "standalone");
const SERVER = path.join(STANDALONE, "server.js");
const NO_BROWSER = process.argv.includes("--no-browser");

// Load .env (dotenv is a project dependency).
try {
  require("dotenv").config({ path: path.join(ROOT, ".env") });
} catch (e) {
  // dotenv missing — fall back to whatever is already in the environment.
}

const PORT = process.env.PORT || "3000";
const HOST = process.env.HOSTNAME || "0.0.0.0";

function log(msg) {
  console.log(`${new Date().toISOString()} [WoodTek] ${msg}`);
}

if (!process.env.DATABASE_URL) {
  log("FATAL: DATABASE_URL is not set. Create a .env next to the app (see .env.example).");
  process.exit(1);
}
if (!process.env.AUTH_SECRET) {
  log("WARNING: AUTH_SECRET is not set. Sessions will not survive a restart. Run: powershell -File ops\\set-auth-secret.ps1");
}
if (!fs.existsSync(SERVER)) {
  log("FATAL: production build not found at " + STANDALONE + ". Run: node scripts/build-prod.cjs");
  process.exit(1);
}

let child = null;
let shuttingDown = false;
let restartCount = 0;
let windowStart = Date.now();

function startServer() {
  log(`Starting server on ${HOST}:${PORT}`);
  child = spawn(process.execPath, [SERVER], {
    cwd: STANDALONE,
    stdio: "inherit",
    env: { ...process.env, HOSTNAME: HOST, PORT },
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    restartCount += 1;
    if (Date.now() - windowStart > 60_000) {
      restartCount = 0;
      windowStart = Date.now();
    }
    if (restartCount > 5) {
      log(`Server crashed ${restartCount} times in a minute — giving up. Check the logs above.`);
      process.exit(1);
    }
    log(`Server exited (code ${code}${signal ? ", signal " + signal : ""}). Restarting in 3s…`);
    setTimeout(startServer, 3000);
  });
}

function openBrowserWhenReady() {
  if (NO_BROWSER) return;
  const http = require("node:http");
  const started = Date.now();
  const tryOnce = () => {
    if (Date.now() - started > 60_000) return; // give up silently after 60s
    const req = http.get(
      { host: "127.0.0.1", port: Number(PORT), path: "/api/health", timeout: 1000 },
      (res) => {
        res.resume();
        if (res.statusCode === 200) {
          log("Server healthy — opening browser.");
          const c = spawn("cmd", ["/c", "start", "", `http://localhost:${PORT}/`], { stdio: "ignore", detached: true });
          c.unref();
        } else {
          setTimeout(tryOnce, 1000);
        }
      },
    );
    req.on("error", () => setTimeout(tryOnce, 1000));
    req.on("timeout", () => req.destroy());
  };
  setTimeout(tryOnce, 1000);
}

process.on("SIGINT", () => { shuttingDown = true; if (child) child.kill("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { shuttingDown = true; if (child) child.kill("SIGTERM"); process.exit(0); });

startServer();
openBrowserWhenReady();

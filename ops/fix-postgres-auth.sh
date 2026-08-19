#!/usr/bin/env bash
# ============================================================================
# WoodTek ERP — Postgres authentication repair (scram-sha-256 rejects owner)
#
# Root cause: pg_hba.conf requires SCRAM-SHA-256, but the password hash stored
# in pg_authid is MD5 (the password was created while password_encryption was
# still 'md5'). The SASL handshake therefore fails with:
#     "password authentication failed" / SCRAM-SHA-256 authentication failed.
#
# Fix procedure (safe, reversible, ~10 seconds of "trust"):
#   1. back up pg_hba.conf
#   2. temporarily prepend TRUST lines for woodtek_owner (so it can connect)
#   3. force password_encryption = scram-sha-256
#   4. ALTER USER ... WITH PASSWORD (re-hashes the password as SCRAM)
#   5. restore pg_hba.conf (removes the trust lines)
#   6. verify a real SCRAM login over TCP
#
# Usage (run ON THE VM, as root):
#   sudo bash ops/fix-postgres-auth.sh [user] [password] [database]
#   sudo bash ops/fix-postgres-auth.sh --check      # diagnose only, change nothing
#
# Defaults: woodtek_owner / 1234 / woodtek_factory
# ============================================================================
set -euo pipefail

DB_USER="${1:-woodtek_owner}"
DB_PASS="${2:-1234}"
DB_NAME="${3:-woodtek_factory}"
CHECK_ONLY=0

if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=1
  DB_USER="${2:-woodtek_owner}"
  DB_PASS="${3:-1234}"
  DB_NAME="${4:-woodtek_factory}"
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root (sudo bash fix-postgres-auth.sh ...)" >&2
  exit 1
fi

psql_su() {
  if command -v sudo >/dev/null 2>&1; then
    sudo -u postgres psql "$@"
  else
    su postgres -c "psql $(printf '%q ' "$@")"
  fi
}

echo "== WoodTek ERP Postgres auth repair =="

# ---- locate config files ---------------------------------------------------
HBA_FILE="$(psql_su -tAc 'SHOW hba_file' 2>/dev/null | tr -d '[:space:]' || true)"
CONFIG_FILE="$(psql_su -tAc 'SHOW config_file' 2>/dev/null | tr -d '[:space:]' || true)"

if [ -z "$HBA_FILE" ]; then
  HBA_FILE="$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1 || true)"
fi
if [ -z "$HBA_FILE" ] || [ ! -f "$HBA_FILE" ]; then
  echo "ERROR: could not locate pg_hba.conf (tried SHOW hba_file and /etc/postgresql/*/main/pg_hba.conf)." >&2
  exit 1
fi

echo "pg_hba.conf : $HBA_FILE"
[ -n "$CONFIG_FILE" ] && echo "postgresql.conf: $CONFIG_FILE"

# ---- diagnose --------------------------------------------------------------
PE="$(psql_su -tAc 'SHOW password_encryption' 2>/dev/null | tr -d '[:space:]' || true)"
echo "password_encryption setting: ${PE:-unknown}"

HASH_PREFIX="$(psql_su -tAc "SELECT CASE WHEN rolpassword LIKE 'SCRAM%' THEN 'scram-sha-256' WHEN rolpassword LIKE 'md5%' THEN 'md5' WHEN rolpassword IS NULL THEN 'none (no password set)' ELSE 'other' END FROM pg_authid WHERE rolname='${DB_USER}';" 2>/dev/null | tr -d '[:space:]' || true)"
echo "stored password hash for ${DB_USER}: ${HASH_PREFIX:-user not found}"

if [ "$CHECK_ONLY" = "1" ]; then
  echo
  echo "Diagnosis complete (nothing changed)."
  if [ "$PE" = "scram-sha-256" ] && [ "$HASH_PREFIX" = "md5" ]; then
    echo ">> Confirmed: pg_hba wants SCRAM but the stored hash is MD5 — run without --check to repair."
  elif [ "$PE" = "scram-sha-256" ] && [ "$HASH_PREFIX" = "scram-sha-256" ]; then
    echo ">> Hash looks SCRAM already. If logins still fail, re-run without --check to force-set the password to '${DB_PASS}'."
  else
    echo ">> See notes above."
  fi
  exit 0
fi

# ---- 1. backup -------------------------------------------------------------
TS="$(date +%Y%m%d-%H%M%S)"
HBA_BAK="${HBA_FILE}.bak-${TS}"
cp -a "$HBA_FILE" "$HBA_BAK"
echo "Backed up pg_hba.conf -> $HBA_BAK"

# ---- 2. force password_encryption = scram-sha-256 --------------------------
if [ "$PE" != "scram-sha-256" ]; then
  echo "Forcing password_encryption = 'scram-sha-256' (ALTER SYSTEM) ..."
  psql_su -c "ALTER SYSTEM SET password_encryption = 'scram-sha-256';" >/dev/null
  psql_su -c "SELECT pg_reload_conf();" >/dev/null
  PE="$(psql_su -tAc 'SHOW password_encryption' | tr -d '[:space:]')"
  echo "password_encryption now: $PE"
fi

# ---- 3. temporary TRUST lines (prepended so they win first-match) ----------
TMP_BLOCK="$(mktemp)"
{
  echo "# --- TEMP TRUST (WoodTek auth repair $(date +%F)) — removed automatically ---"
  echo "host    all             ${DB_USER}   127.0.0.1/32            trust"
  echo "host    all             ${DB_USER}   ::1/128                 trust"
  echo "host    all             ${DB_USER}   0.0.0.0/0               trust"
  echo "host    all             ${DB_USER}   ::0/0                   trust"
  echo "# --- /TEMP TRUST ---"
  cat "$HBA_FILE"
} > "$TMP_BLOCK"
mv "$TMP_BLOCK" "$HBA_FILE"
psql_su -c "SELECT pg_reload_conf();" >/dev/null
echo "Temporary trust lines active."

# ---- 4. re-hash the password as SCRAM --------------------------------------
echo "ALTER USER ${DB_USER} WITH PASSWORD '****' ..."
psql_su -v ON_ERROR_STOP=1 -c "ALTER USER \"${DB_USER}\" WITH PASSWORD '${DB_PASS}';" >/dev/null
NEW_PREFIX="$(psql_su -tAc "SELECT CASE WHEN rolpassword LIKE 'SCRAM%' THEN 'scram-sha-256' WHEN rolpassword LIKE 'md5%' THEN 'md5' ELSE 'other' END FROM pg_authid WHERE rolname='${DB_USER}';" | tr -d '[:space:]')"
echo "Stored hash is now: $NEW_PREFIX"
if [ "$NEW_PREFIX" != "scram-sha-256" ]; then
  echo "WARNING: hash still not SCRAM (got '$NEW_PREFIX'). Check password_encryption and retry." >&2
fi

# ---- 5. restore pg_hba.conf (removes the trust lines) ----------------------
mv "$HBA_BAK" "$HBA_FILE"
psql_su -c "SELECT pg_reload_conf();" >/dev/null
echo "pg_hba.conf restored (trust lines removed)."

# ---- 6. verify a real SCRAM login over TCP ---------------------------------
echo
echo "Verifying login: ${DB_USER}@127.0.0.1/${DB_NAME} ..."
if PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 'LOGIN OK';" >/dev/null 2>&1; then
  echo "SUCCESS: SCRAM login works with the new password."
  echo "If the app still cannot connect, check the LAN line in pg_hba.conf covers the client IP (e.g. 192.168.220.0/24)."
else
  echo "FAILED: TCP login still rejected. Re-run with --check and inspect:"
  echo "  - pg_hba.conf rule for the client's IP (must be scram-sha-256)"
  echo "  - postgres is listening on the LAN interface (listen_addresses)"
  echo "  - the app's DATABASE_URL uses the correct password"
  exit 1
fi

echo
echo "Done. The password for '${DB_USER}' is now '${DB_PASS}' with a SCRAM-SHA-256 hash."

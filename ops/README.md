# WoodTek ERP — Ops Runbooks

Two things live here:

| File | Purpose |
| --- | --- |
| `fix-postgres-auth.sh` | Repairs the `scram-sha-256` / `woodtek_owner` login failure on the DB server. |
| (this file) | Step-by-step rollout of Feature B (scrap & rework, downtime, live WIP board). |

---

## 1. Fix the Postgres auth failure

**Symptom:** the app (and/or `psql`) rejects `woodtek_owner / 1234` with
`password authentication failed for user "woodtek_owner"` while `pg_hba.conf`
demands `scram-sha-256`.

**Root cause:** the password hash stored in `pg_authid` is still MD5 (the role
was created while `password_encryption = 'md5'`), so the SCRAM handshake fails.
Setting the password again while `password_encryption = 'scram-sha-256'`
re-hashes it correctly.

**Fix (run ON the VM, as root):**

```bash
# diagnose first — changes nothing
sudo bash ops/fix-postgres-auth.sh --check

# then repair (backs up pg_hba.conf, temp-trust → ALTER USER → restore → verify)
sudo bash ops/fix-postgres-auth.sh
```

The script does exactly the `trust → ALTER USER → restore` procedure and
finishes with a real SCRAM login test over TCP. It has been validated against
Postgres 17 (Debian) with the failure reproduced first.

Manual equivalent (if you prefer):

```bash
sudo -u postgres psql -c "SHOW hba_file;"          # e.g. /etc/postgresql/17/main/pg_hba.conf
sudo cp /etc/postgresql/17/main/pg_hba.conf /etc/postgresql/17/main/pg_hba.conf.bak
# prepend at the very top of pg_hba.conf:
#   host all woodtek_owner 0.0.0.0/0 trust
sudo -u postgres psql -c "SELECT pg_reload_conf();"
sudo -u postgres psql -c "ALTER USER woodtek_owner WITH PASSWORD '1234';"
# remove the trust line(s), then:
sudo -u postgres psql -c "SELECT pg_reload_conf();"
PGPASSWORD=1234 psql -h 127.0.0.1 -U woodtek_owner -d woodtek_factory -c "SELECT 1;"
```

> **Important:** I could not reach `192.168.220.179` from the sandbox that
> built this (it is a private LAN address with no route from a cloud host).
> Run the script above from a machine on the factory LAN (or the VM console).

---

## 2. Roll out Feature B (scrap & rework, downtime, live WIP board)

### 2.1 Apply the schema migration (on the DB, as `woodtek_owner`)

```bash
psql "postgres://woodtek_owner:1234@192.168.220.179:5432/woodtek_factory" \
  -f drizzle/0004_quality_downtime_wip.sql
```

The migration is idempotent — it creates `quality_events` and
`downtime_events` plus indexes. (The app's own schema is managed by
`drizzle-kit push`; this file matches `src/db/schema.ts`.)

### 2.2 Deploy the new code

```bash
cd /home/user/erp-ref        # or the machine running the app
git pull origin <branch>     # feature-b-quality-downtime-wip
npm install
npm run build                # optional; dev mode works too
# restart the app / launcher
```

### 2.3 What's new

- **Live WIP Board** (sidebar → *Live WIP Board*): auto-refreshing (5s) view of
  every station — running job + live timer, queue, open downtime — plus
  order-level WIP, open rework and scrap counts, and a KPI strip.
  Available to Manager, Sales, Operator, QA, Technician.
- **Scrap & Rework** (sidebar → *Scrap & Rework*): defect log with filters,
  record-defect form, resolve/close rework, KPI cards, manager delete.
- **Downtime Log** (sidebar → *Downtime Log*): start/end stoppages per machine,
  auto duration, open-downtime banner, history table.
- **Operator Station**: the reject flow now asks **Scrap vs Rework + quantity**
  (creating a quality event automatically), and there is a **MACHINE DOWN**
  button that logs downtime from the floor. Ending a rejection's rework cycle
  (restart → complete) automatically closes the rework event.

### 2.4 Demo data

With `NEXT_PUBLIC_WOODTEK_DEMO=on` the seeder also inserts sample quality and
downtime events so the new screens are populated on first run.

### 2.5 Permissions

| Capability | Manager | Operator | QA & Dispatch | Technician | Sales |
| --- | :-: | :-: | :-: | :-: | :-: |
| View WIP board | ✅ | ✅ | ✅ | ✅ | ✅ |
| View scrap/rework | ✅ | ✅ | ✅ | ✅ | — |
| Record/resolve defects | ✅ | ✅ | ✅ | — | — |
| View downtime | ✅ | ✅ | ✅ | ✅ | — |
| Start/end downtime | ✅ | ✅ | — | ✅ | — |

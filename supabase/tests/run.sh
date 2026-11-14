#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica stub do Supabase + migrations + seed e roda os testes.
# Uso: bash supabase/tests/run.sh   (precisa de Postgres 15+ instalado; não rode como root)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

run() { psql -h "$TMP" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$1"; }
run "$ROOT/supabase/tests/supabase-stub.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do run "$m"; done
run "$ROOT/supabase/seed.sql"
for t in "$ROOT"/supabase/tests/*.test.sql; do run "$t"; done

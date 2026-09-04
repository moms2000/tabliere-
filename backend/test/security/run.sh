#!/usr/bin/env bash
# Lance les tests de sécurité des routes contre un serveur jetable.
# Démarre le backend (base de TEST, sans Redis), attend /health, joue les deux
# suites, puis arrête le serveur. NE JAMAIS pointer DATABASE_URL vers la prod.
#
#   npm run test:security
#   (ou)  DATABASE_URL=postgresql://localhost:5432/tabliere_otp bash test/security/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> backend/

PORT="${PORT:-4021}"
DB="${DATABASE_URL:-postgresql://localhost:5432/tabliere_otp}"
if echo "$DB" | grep -qiE "render|onrender|amazonaws|neon\.tech|supabase"; then
  echo "REFUS : DATABASE_URL ressemble à une base distante/production."; exit 2
fi

LOG="$(mktemp -t tci-sec-srv.XXXXXX.log)"
REDIS_URL="" NODE_ENV=test PORT="$PORT" DATABASE_URL="$DB" node src/server.js > "$LOG" 2>&1 &
SRV=$!
cleanup() { kill "$SRV" 2>/dev/null || true; }
trap cleanup EXIT

# Attendre que le serveur réponde
up=""
for _ in $(seq 1 25); do
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done
if [ -z "$up" ]; then echo "Le serveur de test n'a pas démarré. Log :"; tail -20 "$LOG"; exit 2; fi

export BASE_URL="http://localhost:$PORT/api/v1"
export DATABASE_URL="$DB"

rc=0
node test/security/routes-security.mjs || rc=1
node test/security/event-auth.mjs || rc=1

if [ "$rc" -eq 0 ]; then echo "== Tests sécurité routes : TOUS VERTS =="; else echo "== Tests sécurité routes : ÉCHEC (voir ci-dessus) =="; fi
exit "$rc"

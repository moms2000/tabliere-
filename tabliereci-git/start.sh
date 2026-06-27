#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 TablièreCI — Démarrage"
echo ""

# 1. Vérifier Docker
if ! command -v docker &>/dev/null; then
  echo "❌ Docker non trouvé. Installe Docker Desktop : https://www.docker.com/products/docker-desktop/"
  exit 1
fi

# 2. Lancer PostgreSQL + Redis
echo "▶ Démarrage PostgreSQL + Redis (Docker)..."
cd "$DIR"
docker compose up -d
echo "✅ Base de données prête"
sleep 2

# 3. Migrations
echo "▶ Migrations PostgreSQL..."
cd "$DIR/backend"
node src/db/migrate.js
echo "✅ Migrations terminées"

# 4. Ouvrir le frontend dans le navigateur dans 3s
(sleep 3 && open http://localhost:3000) &

# 5. Lancer backend en arrière-plan
echo ""
echo "▶ Backend API → http://localhost:4000"
cd "$DIR/backend"
npm run dev &
BACK_PID=$!

# 6. Lancer frontend
echo "▶ Frontend   → http://localhost:3000"
cd "$DIR/frontend"
npm run dev

# Cleanup
kill $BACK_PID 2>/dev/null

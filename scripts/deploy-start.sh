#!/bin/sh
set -e

echo "==> Ingobyi API — production startup"
echo "    NODE_ENV=${NODE_ENV:-development}"
echo "    PORT=${PORT:-3001}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Set DATABASE_URL in your .env file (local PostgreSQL connection string)."
  exit 1
fi

echo "==> Running database migrations..."
if ! npx prisma migrate deploy; then
  echo ""
  echo "ERROR: Database migrations failed."
  echo "Check DATABASE_URL and ensure PostgreSQL is running."
  echo "For local dev: npm run prisma:migrate"
  exit 1
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database (RUN_SEED=true)..."
  npx prisma db seed
  echo "==> Seed complete. Set RUN_SEED=false before your next deploy."
fi

echo "==> Starting API server..."
exec node dist/src/main

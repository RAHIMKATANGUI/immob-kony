#!/bin/sh
set -e
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "→ Migrations Prisma…"
  /app/scripts/migrate.sh
fi
exec "$@"

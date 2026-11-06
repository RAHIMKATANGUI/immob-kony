#!/bin/sh
# Applique les migrations Prisma (utilisé par Render « preDeployCommand » et docker-compose)
set -e
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
cd /tools
npx --no-install prisma migrate deploy --schema /app/prisma/schema.prisma

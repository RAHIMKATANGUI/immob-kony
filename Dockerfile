# syntax=docker/dockerfile:1.7
# =====================================================================
#  IMMOB KONY — image de production (Next.js standalone + Prisma)
# =====================================================================
ARG NODE_VERSION=22-bookworm-slim

# ---------- 1. Dépendances ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund

# ---------- 2. Build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables factices pour le build (aucune connexion à la base n'est faite pendant le build)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    JWT_SECRET="build-time-secret-not-used-at-runtime-0000000000"
RUN npx prisma generate && npx next build

# ---------- 3. Outils de migration (CLI Prisma isolée) ----------
FROM node:${NODE_VERSION} AS migrator
WORKDIR /tools
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm init -y >/dev/null && npm install prisma@6.19.3 --no-audit --no-fund && npm cache clean --force

# ---------- 4. Runtime ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=migrator --chown=nextjs:nodejs /tools /tools
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh scripts/migrate.sh ./scripts/
RUN chmod +x ./scripts/*.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]

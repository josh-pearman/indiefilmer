# ── Stage 1: Dependencies ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Build ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# DATABASE_PROVIDER: "sqlite" (default) or "postgresql"
ARG DATABASE_PROVIDER=sqlite
# DATABASE_URL needed at build time for Prisma to validate the schema
ARG DATABASE_URL="file:../data/db.sqlite"
ENV DATABASE_URL=${DATABASE_URL}

# Skip Puppeteer's bundled Chromium download — Alpine Chromium is used at runtime
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsx scripts/prisma-provider.ts
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Chromium for Puppeteer PDF generation (call sheets)
RUN apk add --no-cache chromium

# Tell Puppeteer to use the system-installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/content ./content

# Copy Prisma CLI so that `npx prisma migrate deploy` works at runtime
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy the entrypoint script (runs migrations before starting the app)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Data directory (mount as volume for persistence)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME /app/data

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]

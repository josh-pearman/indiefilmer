#!/usr/bin/env bash
set -e

# ─── Detect database provider from DATABASE_URL ─────────────
DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  # Try loading from .env
  if [ -f .env ]; then
    DB_URL=$(grep -E '^\s*DATABASE_URL=' .env | sed 's/^[[:space:]]*DATABASE_URL=//' | tr -d '"' | tr -d "'")
  fi
fi

if echo "$DB_URL" | grep -qE '^postgres(ql)?://'; then
  PROVIDER="postgresql"
elif echo "$DB_URL" | grep -qE '^file:'; then
  PROVIDER="sqlite"
else
  echo "Could not detect database provider from DATABASE_URL."
  echo "Set DATABASE_URL in your environment or .env file."
  exit 1
fi

echo "Detected database provider: $PROVIDER"

# ─── Patch schema and lock file to match provider ────────────
sed -i.bak "s/provider = \"sqlite\"/provider = \"$PROVIDER\"/" prisma/schema.prisma
sed -i.bak "s/provider = \"postgresql\"/provider = \"$PROVIDER\"/" prisma/schema.prisma
sed -i.bak "s/provider = \"sqlite\"/provider = \"$PROVIDER\"/" prisma/migrations/migration_lock.toml
sed -i.bak "s/provider = \"postgresql\"/provider = \"$PROVIDER\"/" prisma/migrations/migration_lock.toml
rm -f prisma/schema.prisma.bak prisma/migrations/migration_lock.toml.bak

# ─── Run migrations ──────────────────────────────────────────
if [ "$PROVIDER" = "postgresql" ]; then
  echo "Applying migrations via prisma db push (PostgreSQL)..."
  npx prisma db push --accept-data-loss --skip-generate
else
  echo "Applying migrations via prisma migrate deploy (SQLite)..."
  npx prisma migrate deploy
fi

# ─── Generate client and build ───────────────────────────────
echo "Generating Prisma client..."
npx prisma generate

echo "Building application..."
npm run build

echo "Deploy complete."

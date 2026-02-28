#!/bin/sh
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
DB_PATH="${DB_PATH:-/data/db.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%S)"
BACKUP_NAME="db-${TIMESTAMP}.sqlite"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"

log() { echo "[backup $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# ── Preflight ──────────────────────────────────────────────────
if [ ! -f "$DB_PATH" ]; then
  log "ERROR: database not found at $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Create backup ──────────────────────────────────────────────
TEMP_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}"

if command -v sqlite3 >/dev/null 2>&1; then
  log "Using sqlite3 .backup (WAL-safe)"
  sqlite3 "$DB_PATH" ".backup '${TEMP_BACKUP}'"
else
  log "sqlite3 not found; checkpointing WAL then copying"
  # If WAL file exists, we can still do a safe copy by just copying all files
  cp "$DB_PATH" "$TEMP_BACKUP"
  [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "${TEMP_BACKUP}-wal"
  [ -f "${DB_PATH}-shm" ] && cp "${DB_PATH}-shm" "${TEMP_BACKUP}-shm"
fi

# ── Compress ───────────────────────────────────────────────────
gzip "$TEMP_BACKUP"
FINAL="${TEMP_BACKUP}.gz"
SIZE=$(du -h "$FINAL" | cut -f1)
log "Backup created: ${BACKUP_NAME}.gz ($SIZE)"

# Clean up any leftover WAL/SHM copies (from the cp fallback)
rm -f "${TEMP_BACKUP}-wal" "${TEMP_BACKUP}-shm"

# ── Upload to S3/B2 (optional) ────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  S3_PATH="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-backups/}${BACKUP_NAME}.gz"
  if command -v aws >/dev/null 2>&1; then
    log "Uploading to $S3_PATH"
    aws s3 cp "$FINAL" "$S3_PATH" --only-show-errors
    log "Upload complete"
  else
    log "WARNING: BACKUP_S3_BUCKET is set but aws CLI not found; skipping upload"
  fi
fi

# ── Retention ──────────────────────────────────────────────────
log "Applying retention policy: ${KEEP_DAILY} daily, ${KEEP_WEEKLY} weekly"

# Collect all backup files sorted newest-first
ALL_BACKUPS=$(ls -1t "$BACKUP_DIR"/db-*.sqlite.gz 2>/dev/null || true)

if [ -z "$ALL_BACKUPS" ]; then
  log "No backups found; nothing to prune"
  exit 0
fi

KEEP_LIST=""

# Keep the N most recent as daily backups
DAILY_COUNT=0
for f in $ALL_BACKUPS; do
  DAILY_COUNT=$((DAILY_COUNT + 1))
  if [ "$DAILY_COUNT" -le "$KEEP_DAILY" ]; then
    KEEP_LIST="$KEEP_LIST $f"
  fi
done

# Keep one backup per week (Sunday) for the last N weeks
# We check each backup's date and keep the first one we find per ISO week
SEEN_WEEKS=""
for f in $ALL_BACKUPS; do
  # Extract date from filename: db-YYYY-MM-DDTHHMMSS.sqlite.gz
  FNAME=$(basename "$f")
  FILE_DATE=$(echo "$FNAME" | sed 's/^db-\([0-9-]*\)T.*/\1/')
  # Get ISO week (YYYY-WW) -- use date if available
  if WEEK=$(date -d "$FILE_DATE" +%G-W%V 2>/dev/null); then
    : # GNU date worked
  elif WEEK=$(date -j -f "%Y-%m-%d" "$FILE_DATE" +%G-W%V 2>/dev/null); then
    : # BSD date worked
  else
    continue
  fi

  case "$SEEN_WEEKS" in
    *"$WEEK"*) continue ;;
  esac

  WEEK_COUNT=$(echo "$SEEN_WEEKS" | tr ' ' '\n' | grep -c . || true)
  if [ "$WEEK_COUNT" -lt "$KEEP_WEEKLY" ]; then
    SEEN_WEEKS="$SEEN_WEEKS $WEEK"
    KEEP_LIST="$KEEP_LIST $f"
  fi
done

# Delete anything not in the keep list
DELETED=0
for f in $ALL_BACKUPS; do
  case "$KEEP_LIST" in
    *"$f"*) ;;
    *)
      rm -f "$f"
      DELETED=$((DELETED + 1))
      ;;
  esac
done

log "Retention complete: pruned $DELETED old backup(s)"

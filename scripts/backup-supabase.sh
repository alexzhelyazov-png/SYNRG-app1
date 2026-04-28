#!/usr/bin/env bash
# Daily Supabase backup → local + optional cloud upload
#
# Setup:
#   1. Get DB connection string: Supabase Dashboard → Project Settings → Database → Connection string
#   2. Save it in .env.local as SUPABASE_DB_URL=postgresql://...
#   3. Run: chmod +x scripts/backup-supabase.sh
#   4. Add to crontab: crontab -e
#      0 3 * * * cd /Users/aleksandarzhelyazov/synrg-app && ./scripts/backup-supabase.sh >> backup.log 2>&1
#
# Storage:
#   - Local: ~/synrg-backups/synrg-YYYY-MM-DD.sql.gz
#   - Auto-prunes files older than 30 days
#   - Optional: rsync/aws s3 cp uncomment line below for offsite backup

set -e

BACKUP_DIR="$HOME/synrg-backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d-%H%M)
FILENAME="synrg-${DATE}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# Load DB URL from .env.local
if [ -f "$(dirname "$0")/../.env.local" ]; then
  source "$(dirname "$0")/../.env.local"
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL not set. Add it to .env.local"
  exit 1
fi

echo "[$(date)] Starting backup: $FILENAME"

# Dump and compress
pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl | gzip -9 > "$FILEPATH"

SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "[$(date)] Backup complete: $FILEPATH ($SIZE)"

# Prune backups older than 30 days
find "$BACKUP_DIR" -name "synrg-*.sql.gz" -mtime +30 -delete
echo "[$(date)] Pruned old backups (>30 days)"

# Optional: offsite copy
# rsync -avz "$FILEPATH" user@server:/path/to/backups/
# aws s3 cp "$FILEPATH" s3://synrg-backups/ --storage-class STANDARD_IA

echo "[$(date)] Done."

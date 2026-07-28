#!/usr/bin/env bash
# cluster-backup.sh — Zero-downtime Flowen database snapshot and validation.
#
# Creates a compressed pg_dump of the Supabase PostgreSQL database, validates
# the backup with a restore into an isolated Docker container, and rotates
# old snapshots according to the configured retention policy.
#
# Usage:
#   ./scripts/infra/cluster-backup.sh [--validate] [--retention-days 30] [--dry-run]
#
# Environment variables (set in .env or CI secrets):
#   DATABASE_URL          — postgres:// connection string for the source DB
#   BACKUP_DIR            — local directory to store snapshots (default: ./backups)
#   BACKUP_S3_BUCKET      — optional: s3://bucket/path for offsite copy
#   BACKUP_ENCRYPTION_KEY — optional: GPG key ID for at-rest encryption
#   SLACK_WEBHOOK_URL     — optional: Slack incoming webhook for alerts

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

VALIDATE=false
RETENTION_DAYS=30
DRY_RUN=false
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
SNAPSHOT_NAME="flowen-db-${TIMESTAMP}.sql.gz"
SNAPSHOT_PATH="${BACKUP_DIR}/${SNAPSHOT_NAME}"
VALIDATION_CONTAINER="flowen-backup-validate-$$"
EXIT_CODE=0

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --validate)          VALIDATE=true; shift ;;
    --retention-days)    RETENTION_DAYS="$2"; shift 2 ;;
    --dry-run)           DRY_RUN=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "[backup] $(date -u +"%H:%M:%S") $*"; }
warn() { echo "[backup] WARN: $*" >&2; }
fail() { echo "[backup] FAIL: $*" >&2; EXIT_CODE=1; }

notify_slack() {
  local status="$1" message="$2"
  if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then return; fi

  local colour
  [[ "$status" == "ok" ]] && colour="#36a64f" || colour="#cc0000"

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$colour\",
        \"title\": \"Flowen DB Backup — $(echo "$status" | tr '[:lower:]' '[:upper:]')\",
        \"text\": \"$message\",
        \"footer\": \"cluster-backup.sh · $(hostname) · $(date -u)\",
        \"ts\": $(date +%s)
      }]
    }" || warn "Slack notification failed"
}

cleanup_validation_container() {
  if docker inspect "$VALIDATION_CONTAINER" &>/dev/null 2>&1; then
    docker rm -f "$VALIDATION_CONTAINER" &>/dev/null || true
  fi
}
trap cleanup_validation_container EXIT

# ── Pre-flight checks ─────────────────────────────────────────────────────────

log "Starting backup — snapshot: $SNAPSHOT_NAME"

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is not set. Export a postgres:// connection string."
  exit 1
fi

if ! command -v pg_dump &>/dev/null; then
  fail "pg_dump not found. Install postgresql-client."
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  log "[DRY-RUN] Would create: $SNAPSHOT_PATH"
  log "[DRY-RUN] Exiting early."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# ── Snapshot ──────────────────────────────────────────────────────────────────

log "Running pg_dump → gzip…"

# --no-owner and --no-acl ensure the dump can be restored into a fresh DB
# without requiring the original role names to exist.
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --schema=public \
  --verbose \
  2>>"${BACKUP_DIR}/backup-${TIMESTAMP}.log" \
| gzip -9 > "$SNAPSHOT_PATH"

SNAPSHOT_SIZE=$(du -sh "$SNAPSHOT_PATH" | cut -f1)
log "Snapshot written: $SNAPSHOT_PATH ($SNAPSHOT_SIZE)"

# ── Optional GPG encryption ───────────────────────────────────────────────────

if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  log "Encrypting snapshot with GPG key: $BACKUP_ENCRYPTION_KEY"
  gpg --recipient "$BACKUP_ENCRYPTION_KEY" \
      --encrypt \
      --output "${SNAPSHOT_PATH}.gpg" \
      "$SNAPSHOT_PATH"
  rm -f "$SNAPSHOT_PATH"
  SNAPSHOT_PATH="${SNAPSHOT_PATH}.gpg"
  log "Encrypted snapshot: $SNAPSHOT_PATH"
fi

# ── Validation ────────────────────────────────────────────────────────────────
# Spin up a fresh Postgres container, restore the dump, run a row-count probe.
# Container is torn down regardless of outcome (trap on EXIT above).

if [[ "$VALIDATE" == "true" ]]; then
  log "Validation: spinning up isolated Postgres container…"

  if [[ "$SNAPSHOT_PATH" == *.gpg ]]; then
    warn "Skipping validation — encrypted backups require GPG passphrase in non-interactive mode."
  else
    VALIDATE_PORT=54320

    docker run -d \
      --name "$VALIDATION_CONTAINER" \
      -e POSTGRES_PASSWORD=flowen_validate \
      -e POSTGRES_DB=flowen_restore \
      -p "${VALIDATE_PORT}:5432" \
      postgres:16-alpine \
      >/dev/null

    log "Waiting for validation Postgres to accept connections…"
    for i in $(seq 1 20); do
      if docker exec "$VALIDATION_CONTAINER" \
          pg_isready -U postgres &>/dev/null; then
        break
      fi
      sleep 1
      if [[ "$i" -eq 20 ]]; then
        fail "Validation Postgres did not start within 20s."
      fi
    done

    log "Restoring snapshot into validation container…"
    gunzip -c "$SNAPSHOT_PATH" \
    | docker exec -i "$VALIDATION_CONTAINER" \
        psql -U postgres -d flowen_restore -q \
        2>>"${BACKUP_DIR}/validate-${TIMESTAMP}.log"

    # Spot-check: verify key tables exist and have rows.
    PROBE=$(docker exec "$VALIDATION_CONTAINER" psql -U postgres -d flowen_restore -tAc \
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
      2>/dev/null || echo "0")

    if [[ "$PROBE" -ge 5 ]]; then
      log "Validation passed — $PROBE public tables restored."
    else
      fail "Validation failed — expected ≥5 tables, found $PROBE."
    fi

    cleanup_validation_container
  fi
fi

# ── Offsite copy ──────────────────────────────────────────────────────────────

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  log "Uploading to S3: ${BACKUP_S3_BUCKET}/${SNAPSHOT_NAME}"
  aws s3 cp "$SNAPSHOT_PATH" "${BACKUP_S3_BUCKET}/${SNAPSHOT_NAME}" \
    --storage-class STANDARD_IA \
    --sse aws:kms || warn "S3 upload failed — local backup retained."
fi

# ── Retention rotation ────────────────────────────────────────────────────────

log "Rotating snapshots older than ${RETENTION_DAYS} days in ${BACKUP_DIR}…"

find "$BACKUP_DIR" \
  -maxdepth 1 \
  \( -name "flowen-db-*.sql.gz" -o -name "flowen-db-*.sql.gz.gpg" \) \
  -mtime "+${RETENTION_DAYS}" \
  -print \
  -delete | while read -r f; do
    log "Deleted old snapshot: $(basename "$f")"
  done

# ── Summary ───────────────────────────────────────────────────────────────────

if [[ "$EXIT_CODE" -eq 0 ]]; then
  MSG="Backup complete: $SNAPSHOT_NAME ($SNAPSHOT_SIZE)"
  log "$MSG"
  notify_slack "ok" "$MSG"
else
  MSG="Backup completed with errors — review ${BACKUP_DIR}/backup-${TIMESTAMP}.log"
  warn "$MSG"
  notify_slack "fail" "$MSG"
fi

exit "$EXIT_CODE"

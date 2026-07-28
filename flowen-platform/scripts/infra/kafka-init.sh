#!/usr/bin/env bash
# kafka-init.sh — Initialise Flowen Redpanda/Kafka topic configuration.
#
# Creates all partitioned topics required by the platform. Safe to re-run;
# existing topics are skipped with a warning rather than failing.
#
# Usage:
#   ./scripts/infra/kafka-init.sh [--broker localhost:9092] [--dry-run]
#
# Dependencies (one of):
#   - rpk  (Redpanda CLI, installed locally or via `brew install redpanda-data/tap/redpanda`)
#   - docker exec redpanda-1 rpk  (runs inside the running Redpanda container)

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

BROKER="${KAFKA_BROKERS:-localhost:9092}"
DRY_RUN=false
CONTAINER="redpanda-1"

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --broker)  BROKER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ── RPK resolver ──────────────────────────────────────────────────────────────
# Prefer a locally-installed rpk; fall back to running inside the container.

if command -v rpk &>/dev/null; then
  RPK="rpk"
elif docker inspect "$CONTAINER" &>/dev/null 2>&1; then
  RPK="docker exec $CONTAINER rpk"
else
  echo "[kafka-init] ERROR: rpk not found locally and container '$CONTAINER' is not running." >&2
  echo "  Install rpk: brew install redpanda-data/tap/redpanda" >&2
  echo "  Or start the cluster: docker compose up -d redpanda-broker" >&2
  exit 1
fi

echo "[kafka-init] Broker : $BROKER"
echo "[kafka-init] RPK    : $RPK"
echo "[kafka-init] Dry-run: $DRY_RUN"
echo ""

# ── Topic definitions ─────────────────────────────────────────────────────────
#
# Format: "topic-name:partitions:replication-factor:retention-ms"
#
# Partition rationale:
#   flowen.telemetry.frames  — 16 partitions: high-throughput, one per concurrent
#                              session shard; keyed on session_id for ordering.
#   flowen.biofeedback.state — 8 partitions: pacer/tension state updates at
#                              ~10Hz per active session.
#   flowen.session.events    — 4 partitions: start/stop/pause events; low volume,
#                              strict ordering per user (key = user_id).
#   flowen.alerts.infra      — 1 partition: infrastructure alerts; must be totally
#                              ordered for sequential ops processing.
#
# Retention:
#   Telemetry frames: 1 hour  (3_600_000 ms) — ephemeral; persisted to Supabase
#   Biofeedback state: 30 min (1_800_000 ms) — ephemeral
#   Session events: 7 days    (604_800_000 ms) — audit trail
#   Infra alerts: 30 days     (2_592_000_000 ms) — ops history

declare -a TOPICS=(
  "flowen.telemetry.frames:16:1:3600000"
  "flowen.biofeedback.state:8:1:1800000"
  "flowen.session.events:4:1:604800000"
  "flowen.alerts.infra:1:1:2592000000"
)

# ── Create topics ─────────────────────────────────────────────────────────────

created=0
skipped=0
failed=0

for entry in "${TOPICS[@]}"; do
  IFS=':' read -r topic partitions replication retention_ms <<< "$entry"

  echo "[kafka-init] Processing topic: $topic"
  echo "             partitions=$partitions  replication=$replication  retention=${retention_ms}ms"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "             [DRY-RUN] Skipping create."
    continue
  fi

  # rpk topic create exits 0 if the topic already exists (with a warning).
  # We capture stderr to detect the "already exists" case for our counter.
  if stderr_output=$($RPK topic create "$topic" \
      --brokers "$BROKER" \
      --partitions "$partitions" \
      --replicas "$replication" \
      --topic-config "retention.ms=$retention_ms" \
      --topic-config "cleanup.policy=delete" \
      2>&1 >/dev/null); then
    if echo "$stderr_output" | grep -qi "already exists"; then
      echo "             [SKIP] Topic already exists."
      ((skipped++)) || true
    else
      echo "             [OK] Created."
      ((created++)) || true
    fi
  else
    echo "             [WARN] Create returned non-zero. Checking if topic exists…"
    if $RPK topic describe "$topic" --brokers "$BROKER" &>/dev/null; then
      echo "             [SKIP] Topic exists (confirmed)."
      ((skipped++)) || true
    else
      echo "             [FAIL] Could not create or confirm topic '$topic'." >&2
      ((failed++)) || true
    fi
  fi

  echo ""
done

# ── Set broker-level configs ──────────────────────────────────────────────────
# Disable auto-creation of topics to prevent accidental topic proliferation.

if [[ "$DRY_RUN" == "false" ]]; then
  echo "[kafka-init] Applying broker config: auto_create_topics_enabled=false"
  $RPK cluster config set auto_create_topics_enabled false \
    --brokers "$BROKER" 2>/dev/null || \
    echo "[kafka-init] WARN: Could not set auto_create_topics_enabled (requires admin privileges)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo "────────────────────────────────────────"
echo "[kafka-init] Done."
echo "  Created : $created"
echo "  Skipped : $skipped"
echo "  Failed  : $failed"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi

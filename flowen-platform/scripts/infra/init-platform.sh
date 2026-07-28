#!/usr/bin/env bash
# init-platform.sh — One-shot environment bootstrap for Flowen Platform
#
# Run this after cloning or after a major dependency bump:
#   bash scripts/infra/init-platform.sh
#
# What it does:
#   1. Verify required external tooling (node, docker, kubectl, rpk, jq, pg_dump)
#   2. Verify all expected source files from Sections 1-3 exist
#   3. Install / update npm dependencies for the platform and mobile project
#   4. Apply the latest Supabase migration via supabase CLI
#   5. Initialise Kafka topics via kafka-init.sh
#   6. Run TypeScript compile check
#   7. Print environment variable checklist
#
# Usage:
#   DRY_RUN=true bash scripts/infra/init-platform.sh   (read-only audit)
#   bash scripts/infra/init-platform.sh                 (full bootstrap)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN="${DRY_RUN:-false}"
PASS=0; WARN=0; FAIL=0

# ── Colour helpers ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓${NC}  $*"; (( PASS++ )) || true; }
warn() { echo -e "${YELLOW}  ⚠${NC}  $*"; (( WARN++ )) || true; }
fail() { echo -e "${RED}  ✗${NC}  $*"; (( FAIL++ )) || true; }

header() { echo; echo -e "${GREEN}══ $* ══${NC}"; }

# ── Step 1: External tooling ──────────────────────────────────────────────────

header "Step 1 — External tooling"

check_tool() {
  local tool="$1" hint="${2:-}"
  if command -v "$tool" &>/dev/null; then
    ok "$tool $(command -v "$tool")"
  else
    if [[ -n "$hint" ]]; then
      fail "$tool not found — $hint"
    else
      fail "$tool not found"
    fi
  fi
}

check_tool node   "install via nvm or https://nodejs.org"
check_tool npm    "bundled with node"
check_tool docker "https://docs.docker.com/get-docker/"
check_tool jq     "brew install jq / apt install jq"

# Optional but strongly recommended
command -v kubectl &>/dev/null && ok "kubectl found" || warn "kubectl not found — K8s monitoring scripts will not work"
command -v rpk    &>/dev/null && ok "rpk found"    || warn "rpk not found — kafka-init.sh will use docker exec fallback"
command -v pg_dump &>/dev/null && ok "pg_dump found" || warn "pg_dump not found — cluster-backup.sh will not work"
command -v supabase &>/dev/null && ok "supabase CLI found" || warn "supabase CLI not found — run: npm install -g supabase"

# ── Step 2: Source file manifest ──────────────────────────────────────────────

header "Step 2 — Source file manifest"

EXPECTED_FILES=(
  # Section 1 — Client / API
  "public/audio-worklets/pcm-processor.js"
  "src/lib/hooks/useAudioPipeline.ts"
  "src/components/widgets/PacerOrb.tsx"
  "src/components/widgets/VolumeMeter.tsx"
  "src/app/api/webhooks/stripe/route.ts"
  "src/app/api/identity/verify/route.ts"
  "src/proxy.ts"
  "src/middleware/identity-guard.ts"

  # Section 2 — Infrastructure
  "supabase/migrations/20260728_security_policies.sql"
  "src/lib/redisClient.ts"
  "src/lib/infra/websocketServer.ts"
  "src/lib/compliance/anonymizer.ts"
  "scripts/infra/cluster-backup.sh"
  "scripts/infra/kafka-init.sh"

  # Section 3 — System / Mobile
  "src/app/api/infra/error-boundary/route.ts"
  "src/lib/security/self-heal-notifier.ts"
  "scripts/infra/self-heal-agent.js"
  "scripts/infra/scale-alert.sh"
  "flowen-mobile/App.tsx"
  "flowen-mobile/src/lib/audio/AudioPipeline.ts"
  "flowen-mobile/ios/FlowenAudio/FlowenAudioModule.swift"
  "flowen-mobile/ios/FlowenAudio/FlowenAudioModule.m"
  "flowen-mobile/android/app/src/main/cpp/AudioOboeEngine.cpp"
  "flowen-mobile/android/app/src/main/cpp/CMakeLists.txt"
  "flowen-mobile/android/app/src/main/java/com/flowen/audio/FlowenAudioModule.kt"
  "flowen-mobile/android/app/src/main/java/com/flowen/audio/FlowenAudioPackage.kt"
)

for f in "${EXPECTED_FILES[@]}"; do
  if [[ -f "${ROOT}/${f}" ]]; then
    ok "$f"
  else
    fail "MISSING: $f"
  fi
done

# ── Step 3: npm dependencies ──────────────────────────────────────────────────

header "Step 3 — npm dependencies (platform)"

REQUIRED_DEPS=(
  "@anthropic-ai/sdk"
  "@supabase/supabase-js"
  "@supabase/ssr"
  "framer-motion"
  "ioredis"
  "kafkajs"
  "next"
  "stripe"
  "ws"
)

INSTALLED=$(cd "$ROOT" && cat node_modules/.package-lock.json 2>/dev/null \
              || cat node_modules/.modules.yaml 2>/dev/null \
              || echo "")

for dep in "${REQUIRED_DEPS[@]}"; do
  if [[ -d "${ROOT}/node_modules/${dep}" ]]; then
    local_ver=$(node -p "require('${ROOT}/node_modules/${dep}/package.json').version" 2>/dev/null || echo "?")
    ok "$dep@$local_ver"
  else
    fail "$dep NOT INSTALLED — run: npm install"
  fi
done

if [[ "$DRY_RUN" == "false" ]]; then
  echo "  Installing / updating platform dependencies…"
  npm install --prefix "$ROOT" --silent 2>&1 | tail -3
fi

# ── Step 4: Supabase migration ────────────────────────────────────────────────

header "Step 4 — Supabase migration"

MIGRATION="${ROOT}/supabase/migrations/20260728_security_policies.sql"
if [[ ! -f "$MIGRATION" ]]; then
  fail "Migration file missing: $MIGRATION"
elif [[ "$DRY_RUN" == "true" ]]; then
  ok "Migration file present (dry-run — skipping apply)"
elif command -v supabase &>/dev/null; then
  echo "  Applying migration via supabase CLI…"
  supabase db push --db-url "${DATABASE_URL:-}" 2>&1 | tail -5 \
    && ok "supabase db push completed" \
    || warn "supabase db push failed — apply manually: supabase db push"
else
  warn "supabase CLI not found — apply migration manually:"
  warn "  psql \$DATABASE_URL -f $MIGRATION"
fi

# ── Step 5: Kafka topics ──────────────────────────────────────────────────────

header "Step 5 — Kafka topics"

KAFKA_SCRIPT="${ROOT}/scripts/infra/kafka-init.sh"
if [[ ! -f "$KAFKA_SCRIPT" ]]; then
  fail "kafka-init.sh missing"
elif [[ "$DRY_RUN" == "true" ]]; then
  ok "kafka-init.sh present (dry-run — skipping)"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q redpanda; then
  bash "$KAFKA_SCRIPT" 2>&1 | tail -8 \
    && ok "Kafka topics initialised" \
    || warn "kafka-init.sh failed — run manually after Redpanda starts"
else
  warn "Redpanda container not running — start with: docker compose up -d redpanda"
  warn "Then run: bash scripts/infra/kafka-init.sh"
fi

# ── Step 6: TypeScript check ──────────────────────────────────────────────────

header "Step 6 — TypeScript compile check"

if [[ "$DRY_RUN" == "true" ]]; then
  ok "Skipped (dry-run)"
else
  tsc_out=$(cd "$ROOT" && npx tsc --noEmit --skipLibCheck 2>&1 || true)
  if [[ -z "$tsc_out" ]]; then
    ok "tsc --noEmit passed — zero errors"
  else
    error_count=$(echo "$tsc_out" | grep -c ' error TS' || true)
    fail "tsc reported $error_count error(s):"
    echo "$tsc_out" | head -20
  fi
fi

# ── Step 7: Environment variable checklist ────────────────────────────────────

header "Step 7 — Environment variable checklist"

REQUIRED_ENV=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_PRICE_FOUNDING_MONTHLY"
  "STRIPE_PRICE_FOUNDING_QUARTERLY"
  "STRIPE_PRICE_FOUNDING_SIX_MONTHS"
  "STRIPE_PRICE_FOUNDING_YEARLY"
  "REDIS_URL"
  "KAFKA_BROKERS"
  "DIDIT_WEBHOOK_SECRET"
  "DIDIT_API_KEY"
  "ANONYMISATION_SALT"
)

OPTIONAL_ENV=(
  "SLACK_WEBHOOK_URL"
  "ANTHROPIC_API_KEY"
  "SELF_HEAL_ENABLED"
  "K8S_NAMESPACE"
  "S3_BUCKET"
  "GPG_RECIPIENT"
  "EXPO_PUBLIC_WS_URL"
)

echo "  Required:"
for var in "${REQUIRED_ENV[@]}"; do
  if [[ -n "${!var:-}" ]]; then
    ok "$var is set"
  else
    fail "$var NOT SET — add to .env.local"
  fi
done

echo "  Optional:"
for var in "${OPTIONAL_ENV[@]}"; do
  if [[ -n "${!var:-}" ]]; then
    ok "$var is set"
  else
    warn "$var not set"
  fi
done

# ── Summary ────────────────────────────────────────────────────────────────────

header "Summary"
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo -e "  ${RED}Failures:${NC} $FAIL"
echo

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}Platform NOT ready — resolve failures above.${NC}"
  exit 1
elif [[ "$WARN" -gt 0 ]]; then
  echo -e "${YELLOW}Platform PARTIALLY ready — review warnings above.${NC}"
  exit 0
else
  echo -e "${GREEN}Platform READY. You may start the dev server:${NC}"
  echo "  npm run dev"
  exit 0
fi

#!/usr/bin/env bash
# scale-alert.sh — Kubernetes HPA monitoring and Slack capacity alerts.
#
# Evaluates all HPAs in the target namespace. Sends rich Slack alerts when:
#   WARNING  — replicas >= 85% of max  OR  CPU >= 80% of target
#   CRITICAL — replicas == max         OR  CPU >= 95% of target
#
# Run as a Kubernetes CronJob or a local cron entry:
#   */5 * * * * /path/to/scale-alert.sh >> /var/log/flowen-scale-alert.log 2>&1
#
# Dependencies: kubectl (configured), jq, curl

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

NAMESPACE="${K8S_NAMESPACE:-flowen-production}"
SLACK_URL="${SLACK_WEBHOOK_URL:-}"
WARN_REPLICA_PCT=85    # % of maxReplicas that triggers WARNING
CRIT_REPLICA_PCT=100   # % of maxReplicas that triggers CRITICAL (i.e., at max)
WARN_CPU_PCT=80        # % of CPU target that triggers WARNING
CRIT_CPU_PCT=95        # % of CPU target that triggers CRITICAL
DRY_RUN="${DRY_RUN:-false}"

# ── Helpers ───────────────────────────────────────────────────────────────────

log() { echo "[scale-alert] $(date -u +"%H:%M:%S") $*"; }

send_slack() {
  local severity="$1" hpa="$2" curr_rep="$3" max_rep="$4" cpu_pct="$5" target_cpu="$6"
  if [[ -z "$SLACK_URL" ]]; then return; fi

  local fill_pct=$(( curr_rep * 100 / max_rep ))
  local colour emoji
  if [[ "$severity" == "CRITICAL" ]]; then colour="#cc0000"; emoji="🚨"; else colour="#f0a500"; emoji="⚠️"; fi

  local ts
  ts=$(date +%s)

  curl -s -X POST "$SLACK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"text\": \"${emoji} K8s HPA ${severity}: \`${hpa}\` at ${fill_pct}% replica capacity (CPU: ${cpu_pct}%)\",
      \"attachments\": [{
        \"color\": \"${colour}\",
        \"blocks\": [
          {\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":\"${emoji} HPA ${severity}: ${hpa}\",\"emoji\":true}},
          {\"type\":\"section\",\"fields\":[
            {\"type\":\"mrkdwn\",\"text\":\"*Namespace:*\n\`${NAMESPACE}\`\"},
            {\"type\":\"mrkdwn\",\"text\":\"*HPA:*\n\`${hpa}\`\"},
            {\"type\":\"mrkdwn\",\"text\":\"*Replicas:*\n${curr_rep} / ${max_rep} (${fill_pct}%)\"},
            {\"type\":\"mrkdwn\",\"text\":\"*CPU Utilisation:*\n${cpu_pct}% (target: ${target_cpu}%)\"}
          ]},
          {\"type\":\"context\",\"elements\":[{\"type\":\"mrkdwn\",\"text\":\"flowen-platform · $(date -u)\"}]}
        ],
        \"ts\": ${ts}
      }]
    }" 2>/dev/null || log "WARN: Slack send failed"
}

# ── Pre-flight ────────────────────────────────────────────────────────────────

for dep in kubectl jq curl; do
  if ! command -v "$dep" &>/dev/null; then
    log "ERROR: '$dep' not found in PATH. Exiting."
    exit 1
  fi
done

if ! kubectl cluster-info --request-timeout=5s &>/dev/null; then
  log "ERROR: kubectl cannot reach the cluster. Check kubeconfig."
  exit 1
fi

# ── Fetch HPA state ───────────────────────────────────────────────────────────

log "Polling HPAs in namespace: ${NAMESPACE}"

HPA_JSON=$(kubectl get hpa -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
HPA_COUNT=$(echo "$HPA_JSON" | jq '.items | length')

if [[ "$HPA_COUNT" -eq 0 ]]; then
  log "No HPAs found in namespace ${NAMESPACE}. Exiting cleanly."
  exit 0
fi

log "Found ${HPA_COUNT} HPA(s)"

# ── Evaluate each HPA ─────────────────────────────────────────────────────────

alerts=0

while IFS= read -r hpa_json; do
  name=$(echo "$hpa_json" | jq -r '.metadata.name')
  curr_replicas=$(echo "$hpa_json" | jq -r '.status.currentReplicas // 0')
  max_replicas=$(echo  "$hpa_json" | jq -r '.spec.maxReplicas // 1')
  min_replicas=$(echo  "$hpa_json" | jq -r '.spec.minReplicas // 1')

  # Current CPU utilisation (if metric is configured; default 0 if absent)
  curr_cpu=$(echo "$hpa_json" | jq -r '
    [ .status.currentMetrics[]?
      | select(.type == "Resource" and .resource.name == "cpu")
      | .resource.current.averageUtilization // 0
    ] | first // 0')

  # Target CPU utilisation from spec
  target_cpu=$(echo "$hpa_json" | jq -r '
    [ .spec.metrics[]?
      | select(.type == "Resource" and .resource.name == "cpu")
      | .resource.target.averageUtilization // 80
    ] | first // 80')

  fill_pct=$(( curr_replicas * 100 / max_replicas ))

  log "  ${name}: ${curr_replicas}/${max_replicas} replicas (${fill_pct}%), CPU ${curr_cpu}%/${target_cpu}%"

  # ── Severity determination ───────────────────────────────────────────────

  severity=""

  if [[ "$fill_pct" -ge "$CRIT_REPLICA_PCT" ]] || \
     [[ "$curr_cpu" -ge "$(( target_cpu * CRIT_CPU_PCT / 100 ))" ]]; then
    severity="CRITICAL"
  elif [[ "$fill_pct" -ge "$WARN_REPLICA_PCT" ]] || \
       [[ "$curr_cpu" -ge "$(( target_cpu * WARN_CPU_PCT / 100 ))" ]]; then
    severity="WARNING"
  fi

  if [[ -n "$severity" ]]; then
    log "  → ${severity} alert for ${name}"
    (( alerts++ )) || true

    if [[ "$DRY_RUN" == "false" ]]; then
      send_slack "$severity" "$name" "$curr_replicas" "$max_replicas" "$curr_cpu" "$target_cpu"
    else
      log "  [DRY-RUN] Would send ${severity} Slack alert"
    fi
  fi

done < <(echo "$HPA_JSON" | jq -c '.items[]')

# ── Summary ───────────────────────────────────────────────────────────────────

log "Done. ${alerts} alert(s) fired."

# Exit non-zero if any CRITICAL alert was fired so CI/cron can page on-call.
if echo "$HPA_JSON" | jq -e '
  .items[] |
  (.status.currentReplicas // 0) >= (.spec.maxReplicas // 1)
' &>/dev/null; then
  exit 2   # CRITICAL — at-max
fi

exit 0

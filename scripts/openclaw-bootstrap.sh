#!/usr/bin/env bash
set -euo pipefail

INSFORGE_BASE_URL="${INSFORGE_BASE_URL:-https://ijeed7kh.us-west.insforge.app}"
SELF_REGISTER_ENDPOINT="${SELF_REGISTER_ENDPOINT:-$INSFORGE_BASE_URL/functions/agent-self-register}"
AUTOMATION_ENDPOINT="${AUTOMATION_ENDPOINT:-$INSFORGE_BASE_URL/functions/agent-automation-bridge}"
SELF_REGISTER_SECRET="${SELF_REGISTER_SECRET:-}"
AGENT_AUTOMATION_SECRET="${AGENT_AUTOMATION_SECRET:-}"
AGENT_NAME="${AGENT_NAME:-OpenClaw-Autonomous-Operator}"
AGENT_ROLE="${AGENT_ROLE:-Global Operations Agent}"
AGENT_MODEL="${AGENT_MODEL:-openai/gpt-4o-mini}"
AGENT_SOURCE="${AGENT_SOURCE:-openclaw-vps}"
HEARTBEAT_SECONDS="${HEARTBEAT_SECONDS:-60}"
RUN_FOREVER="${RUN_FOREVER:-true}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

if [[ -z "${SELF_REGISTER_SECRET}" ]]; then
  echo "[warn] SELF_REGISTER_SECRET is empty. Set it for production hardening."
fi

notify_telegram() {
  local message="$1"
  if [[ -z "$TELEGRAM_BOT_TOKEN" || -z "$TELEGRAM_CHAT_ID" ]]; then
    return 0
  fi

  curl -sS --max-time 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"text\": \"${message}\"}" >/dev/null || true
}

echo "[info] Registering agent at $SELF_REGISTER_ENDPOINT"

REGISTER_JSON=$(curl -sS --max-time 30 -X POST "$SELF_REGISTER_ENDPOINT" \
  -H "Content-Type: application/json" \
  ${SELF_REGISTER_SECRET:+-H "X-Agent-Register-Secret: ${SELF_REGISTER_SECRET}"} \
  -d "{\"name\":\"${AGENT_NAME}\",\"role\":\"${AGENT_ROLE}\",\"model\":\"${AGENT_MODEL}\",\"source\":\"${AGENT_SOURCE}\",\"start_session\":true}")

if [[ -z "$REGISTER_JSON" ]]; then
  echo "[error] Empty registration response"
  exit 1
fi

AGENT_ID=$(printf '%s' "$REGISTER_JSON" | python -c "import json,sys;print(json.load(sys.stdin).get('agent',{}).get('id',''))")
AGENT_API_KEY=$(printf '%s' "$REGISTER_JSON" | python -c "import json,sys;print(json.load(sys.stdin).get('agent',{}).get('apiKey',''))")

if [[ -z "$AGENT_ID" || -z "$AGENT_API_KEY" ]]; then
  echo "[error] Failed to parse agent credentials from registration response"
  echo "$REGISTER_JSON"
  exit 1
fi

echo "[ok] Registered agent: $AGENT_ID"
notify_telegram "✅ ${AGENT_NAME} registered (id: ${AGENT_ID})"

run_cycle() {
  echo "[info] Running provider discovery cycle"

  local payload
  payload="{\"action\":\"discover_provider_updates\",\"agentId\":\"${AGENT_ID}\",\"agentApiKey\":\"${AGENT_API_KEY}\",\"providers\":[\"openrouter\",\"huggingface\",\"gemini\",\"sip\"],\"postForumUpdate\":false}"

  local response
  response=$(curl -sS --max-time 45 -X POST "$AUTOMATION_ENDPOINT" \
    -H "Content-Type: application/json" \
    ${AGENT_AUTOMATION_SECRET:+-H "X-Agent-Automation-Secret: ${AGENT_AUTOMATION_SECRET}"} \
    -d "$payload")

  local ok
  ok=$(printf '%s' "$response" | python -c "import json,sys;print(str(bool(json.load(sys.stdin).get('ok'))).lower())" 2>/dev/null || echo "false")

  if [[ "$ok" == "true" ]]; then
    echo "[ok] Discovery cycle complete"
  else
    echo "[warn] Discovery cycle returned non-ok response"
    echo "$response"
  fi
}

run_cycle

if [[ "$RUN_FOREVER" != "true" ]]; then
  echo "[info] RUN_FOREVER=false, exiting after one cycle"
  exit 0
fi

while true; do
  sleep "$HEARTBEAT_SECONDS"
  run_cycle || true
  notify_telegram "🔄 ${AGENT_NAME} heartbeat complete"
done

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BASE_URL=${LITELLM_BASE_URL:-http://localhost:4000}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

MASTER_KEY=${LITELLM_MASTER_KEY:-}
if [[ -z "$MASTER_KEY" && -f "$SCRIPT_DIR/.env" ]]; then
  while IFS='=' read -r name value; do
    name=${name%$'\r'}
    value=${value%$'\r'}
    if [[ "$name" == "LITELLM_MASTER_KEY" ]]; then
      MASTER_KEY=$value
      break
    fi
  done < "$SCRIPT_DIR/.env"
fi
[[ -n "$MASTER_KEY" ]] || fail "Key-generate failure — set LITELLM_MASTER_KEY; see the 'Key-generate failure' troubleshooting row"
case "$MASTER_KEY" in
  *'$'*|*"'"*|*'"'*|*' '*|*'\'*)
    fail 'Invalid LITELLM_MASTER_KEY — Compose interpolates $ in unquoted .env values; regenerate as hex, see .env.example'
    ;;
esac

READY_TIMEOUT_SECONDS=${LITELLM_READY_TIMEOUT_SECONDS:-120}
case "$READY_TIMEOUT_SECONDS" in
  ''|*[!0-9]*) fail "LITELLM_READY_TIMEOUT_SECONDS must be a positive integer" ;;
esac
[[ "$READY_TIMEOUT_SECONDS" -gt 0 ]] || fail "LITELLM_READY_TIMEOUT_SECONDS must be a positive integer"

printf 'Waiting for gateway liveliness at %s (timeout: %ss)' "$BASE_URL" "$READY_TIMEOUT_SECONDS"
ready_deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
until curl --fail --silent --output /dev/null --connect-timeout 2 --max-time 5 \
  "$BASE_URL/health/liveliness"; do
  if (( SECONDS >= ready_deadline )); then
    printf '\n' >&2
    fail "Gateway did not become live within ${READY_TIMEOUT_SECONDS}s — run docker compose ps and docker compose logs litellm"
  fi
  printf '.'
  sleep 2
done
printf ' ready\n'

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

printf '%s' '{"key_alias":"verify-script","models":["default","planning"]}' > "$TMP_DIR/key-request.json"
if ! curl --fail-with-body --silent --show-error \
  -X POST "$BASE_URL/key/generate" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/key-request.json" \
  -o "$TMP_DIR/key-response.json"; then
  fail "Key-generate failure — check the gateway, master key, or an existing verify-script alias; see the 'Key-generate failure' troubleshooting row"
fi

key_response=$(<"$TMP_DIR/key-response.json")
if [[ "$key_response" =~ \"key\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
  VIRTUAL_KEY=${BASH_REMATCH[1]}
else
  fail "Key-generate failure — the response did not contain a virtual key; see the 'Key-generate failure' troubleshooting row"
fi
printf "created virtual key 'verify-script' — this is the per-engineer visibility lever\n"

printf '%s' '{"model":"default","messages":[{"role":"user","content":"Reply with exactly: spend kit verified"}],"temperature":0,"max_tokens":20}' > "$TMP_DIR/default-request.json"
if ! curl --fail-with-body --silent --show-error \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $VIRTUAL_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/default-request.json" \
  -o "$TMP_DIR/default-response.json"; then
  fail "Bad or missing Gemini key — default request failed; see the 'Bad or missing Gemini key' troubleshooting row"
fi
printf '1/3 default tier OK (this cost fractions of a cent)\n'

printf '%s' '{"model":"planning","messages":[{"role":"user","content":"Reply with exactly: planning tier verified"}],"temperature":0,"max_tokens":20}' > "$TMP_DIR/planning-request.json"
if ! curl --fail-with-body --silent --show-error \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $VIRTUAL_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/planning-request.json" \
  -o "$TMP_DIR/planning-response.json"; then
  fail "Bad or missing Gemini key — planning request failed; see the 'Bad or missing Gemini key' troubleshooting row"
fi
printf '2/3 planning tier OK (same endpoint, frontier model, your choice)\n'

if ! curl --fail-with-body --silent --show-error \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $VIRTUAL_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/default-request.json" \
  -D "$TMP_DIR/cache-headers.txt" \
  -o "$TMP_DIR/cache-response.json"; then
  fail "No cache hit on verify step 3 — repeated request failed; see the 'No cache hit on verify step 3' troubleshooting row"
fi

cache_hit=false
while IFS= read -r header; do
  header=${header%$'\r'}
  lower_header=$(printf '%s' "$header" | tr '[:upper:]' '[:lower:]')
  if [[ "$lower_header" == x-litellm-cache-key:* ]]; then
    cache_hit=true
    break
  fi
done < "$TMP_DIR/cache-headers.txt"
[[ "$cache_hit" == true ]] || fail "No cache hit on verify step 3 — x-litellm-cache-key was absent; see the 'No cache hit on verify step 3' troubleshooting row"
printf '3/3 cache hit — that one was free\n'

printf '\nDashboard: %s/ui\n' "$BASE_URL"
printf "Log in as admin with LITELLM_MASTER_KEY (or your optional UI overrides) — the three requests are attributed to key 'verify-script'.\n"

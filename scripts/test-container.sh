#!/usr/bin/env bash
set -euo pipefail

image="${1:?Pass the built Arcade image name}"
container="arcade-container-smoke-${GITHUB_RUN_ID:-local}-$$"
port=18080

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --name "$container" --publish "127.0.0.1:${port}:8080" "$image" >/dev/null

ready=0
for attempt in {1..20}; do
  if curl --fail --silent --max-time 1 "http://127.0.0.1:${port}/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" != 1 ]]; then
  docker logs "$container"
  echo "Arcade container did not become healthy on port 8080." >&2
  exit 1
fi

curl --fail --silent "http://127.0.0.1:${port}/health" | grep --quiet --line-regexp 'ok'
curl --fail --silent --output /dev/null "http://127.0.0.1:${port}/"
curl --fail --silent --output /dev/null "http://127.0.0.1:${port}/container-route-check"
curl --fail --silent --output /dev/null "http://127.0.0.1:${port}/nds/"
curl --fail --silent --output /dev/null "http://127.0.0.1:${port}/nds/LICENSE"

nds_headers=$(curl --fail --silent --head "http://127.0.0.1:${port}/nds/" | tr -d '\r')
grep --ignore-case --quiet --line-regexp 'Cross-Origin-Opener-Policy: same-origin' <<<"$nds_headers"
grep --ignore-case --quiet --line-regexp 'Cross-Origin-Embedder-Policy: require-corp' <<<"$nds_headers"
grep --ignore-case --quiet --line-regexp 'Cross-Origin-Resource-Policy: same-origin' <<<"$nds_headers"

wasm_type=$(curl --fail --silent --head "http://127.0.0.1:${port}/nds/dist/melonds.wasm" | tr -d '\r' | awk -F': ' 'tolower($1) == "content-type" { print $2 }')
[[ "$wasm_type" == "application/wasm" ]]

root_headers=$(curl --fail --silent --head "http://127.0.0.1:${port}/" | tr -d '\r')
if grep --ignore-case --quiet '^Cross-Origin-Embedder-Policy:' <<<"$root_headers"; then
  echo "Cross-origin isolation must stay limited to the Nintendo DS route." >&2
  exit 1
fi

echo "Arcade container health, client-route fallback, and isolated Nintendo DS player checks passed."

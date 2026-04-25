#!/bin/sh
set -eu

cd /app

mkdir -p /app/node_modules

MANIFEST_HASH="$(
  find /app -maxdepth 3 -name package.json -type f \
    ! -path '*/node_modules/*' \
    | sort \
    | xargs cat \
    | sha256sum \
    | awk '{print $1}'
)"

CURRENT_HASH=""
if [ -f /app/node_modules/.ledger-deps-hash ]; then
  CURRENT_HASH="$(cat /app/node_modules/.ledger-deps-hash)"
fi

if [ "$MANIFEST_HASH" != "$CURRENT_HASH" ] || [ ! -f /app/node_modules/.ledger-ready ]; then
  npm install
  npm run build --workspace @ledger/shared
  printf '%s' "$MANIFEST_HASH" > /app/node_modules/.ledger-deps-hash
  touch /app/node_modules/.ledger-ready
fi

#!/bin/sh
set -eu

cd /app

mkdir -p /app/node_modules

if [ ! -f /app/node_modules/.ledger-ready ]; then
  npm install
  npm run build --workspace @ledger/shared
  touch /app/node_modules/.ledger-ready
fi

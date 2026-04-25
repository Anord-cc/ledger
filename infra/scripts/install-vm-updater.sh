#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ledger}"
TARGET_BIN="${TARGET_BIN:-/usr/local/bin/ledger-update}"

if [ ! -f "$APP_DIR/infra/scripts/vm-update.sh" ]; then
  printf 'Expected updater at %s/infra/scripts/vm-update.sh\n' "$APP_DIR" >&2
  exit 1
fi

install -m 0755 "$APP_DIR/infra/scripts/vm-update.sh" "$TARGET_BIN"
printf 'Installed Ledger updater to %s\n' "$TARGET_BIN"
printf 'You can now run: %s\n' "$TARGET_BIN"

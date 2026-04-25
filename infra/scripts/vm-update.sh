#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_URL="https://github.com/Anord-cc/ledger.git"
DEFAULT_BRANCH="main"
DEFAULT_APP_DIR="/opt/ledger"

resolve_default_app_dir() {
  local script_dir repo_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo_root="$(cd "$script_dir/../.." && pwd)"

  if [ -f "$repo_root/docker-compose.yml" ] && [ -d "$repo_root/.git" ]; then
    printf '%s' "$repo_root"
    return
  fi

  printf '%s' "$DEFAULT_APP_DIR"
}

APP_DIR="${APP_DIR:-$(resolve_default_app_dir)}"
REPO_URL="${REPO_URL:-$DEFAULT_REPO_URL}"
BRANCH="${BRANCH:-$DEFAULT_BRANCH}"
FORCE_RESET="${FORCE_RESET:-0}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

ensure_repo() {
  if [ -d "$APP_DIR/.git" ]; then
    return
  fi

  log "Cloning Ledger into $APP_DIR"
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
}

update_repo() {
  cd "$APP_DIR"

  if [ -n "$(git status --porcelain)" ] && [ "$FORCE_RESET" != "1" ]; then
    printf 'Refusing to update because %s has local changes. Re-run with FORCE_RESET=1 to discard them.\n' "$APP_DIR" >&2
    exit 1
  fi

  log "Fetching latest code from $BRANCH"
  git fetch origin "$BRANCH" --prune
  git checkout "$BRANCH"

  if [ "$FORCE_RESET" = "1" ]; then
    git reset --hard "origin/$BRANCH"
  else
    git pull --ff-only origin "$BRANCH"
  fi
}

ensure_env() {
  cd "$APP_DIR"

  if [ -f .env ]; then
    return
  fi

  if [ -f .env.example ]; then
    cp .env.example .env
    log "Created .env from .env.example. Review it before exposing Ledger publicly."
    return
  fi

  printf 'Missing .env and .env.example in %s\n' "$APP_DIR" >&2
  exit 1
}

update_stack() {
  cd "$APP_DIR"

  log "Pulling base images"
  docker compose pull bootstrap postgres redis api web worker

  log "Starting database and cache"
  docker compose up -d postgres redis

  log "Refreshing dependencies"
  docker compose run --rm bootstrap

  log "Restarting Ledger services"
  docker compose up -d --remove-orphans api web worker

  log "Current container status"
  docker compose ps
}

print_summary() {
  log "Ledger update complete"
  printf 'App dir:    %s\n' "$APP_DIR"
  printf 'Branch:     %s\n' "$BRANCH"
  printf 'API health: http://127.0.0.1:4000/health\n'
  printf 'Web app:    http://127.0.0.1:5173\n'
}

main() {
  require_cmd git
  require_cmd docker

  ensure_repo
  update_repo
  ensure_env
  update_stack

  print_summary
}

main "$@"

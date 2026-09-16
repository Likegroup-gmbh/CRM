#!/usr/bin/env bash
# Worktree CRM-v2 vom Branch v2 anlegen (oder nur Env/npm nachziehen).
# Aus einem Checkout des Repos aufrufen: ./scripts/setup-v2-worktree.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DEST="${1:-$(cd "$ROOT/.." && pwd)/CRM-v2}"

git -C "$ROOT" fetch origin

if git -C "$ROOT" worktree list --porcelain | grep -q "^worktree $DEST$"; then
  echo "Worktree existiert schon: $DEST"
elif git -C "$ROOT" show-ref --verify --quiet refs/heads/v2; then
  git -C "$ROOT" worktree add "$DEST" v2
else
  git -C "$ROOT" worktree add --track -b v2 "$DEST" origin/v2
fi

if [[ -f "$ROOT/.env" && ! -f "$DEST/.env" ]]; then
  cp "$ROOT/.env" "$DEST/.env"
  echo " .env aus $ROOT kopiert"
fi

if [[ -f "$DEST/.env" ]]; then
  if grep -q '^VITE_APP_CHANNEL=' "$DEST/.env"; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' 's/^VITE_APP_CHANNEL=.*/VITE_APP_CHANNEL=v2/' "$DEST/.env"
    else
      sed -i 's/^VITE_APP_CHANNEL=.*/VITE_APP_CHANNEL=v2/' "$DEST/.env"
    fi
  else
    printf '\n# Parallelbetrieb: v2-Badge\nVITE_APP_CHANNEL=v2\n' >> "$DEST/.env"
  fi
else
  echo "Kein .env in $DEST — VITE_APP_CHANNEL=v2 selbst setzen." >&2
fi

(cd "$DEST" && npm install)

echo
echo "v2-Worktree: $DEST"
echo "Start: cd \"$DEST\" && npm run dev -- --port 3001"
echo "v1 bleibt wo es ist. Hotfix: dort staging, danach hier: git merge origin/staging"

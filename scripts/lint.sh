#!/usr/bin/env bash
# scripts/lint.sh — lint + typecheck
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "[lint] eslint..."
npm run lint
echo "[lint] typecheck..."
npm run typecheck
echo "[lint] done."

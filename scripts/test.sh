#!/usr/bin/env bash
# scripts/test.sh — 로컬 테스트 실행 편의 스크립트
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-fast}"

case "$MODE" in
  unit)
    echo "[test] vitest unit..."
    npx vitest run tests/unit/ --passWithNoTests
    ;;
  mock)
    echo "[test] playwright mock e2e..."
    npx playwright test e2e/mock/ --project=mock
    ;;
  smoke)
    echo "[test] playwright smoke e2e..."
    npx playwright test e2e/smoke/ --project=smoke
    ;;
  fast)
    echo "[test] fast loop: lint + typecheck + unit + mock"
    npm run lint
    npm run typecheck
    npx vitest run tests/unit/ --passWithNoTests
    npx playwright test e2e/mock/ --project=mock
    ;;
  gate)
    echo "[test] gate loop: fast + smoke"
    bash "$ROOT/scripts/test.sh" fast
    bash "$ROOT/scripts/test.sh" smoke
    ;;
  *)
    echo "사용법: test.sh [unit|mock|smoke|fast|gate]"
    exit 1
    ;;
esac

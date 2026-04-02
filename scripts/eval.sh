#!/usr/bin/env bash
# scripts/eval.sh — 하네스 실행
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-fast}"

case "$MODE" in
  fast)
    python harness/runner/main.py
    ;;
  gate)
    python harness/runner/main.py --gate
    ;;
  status)
    python harness/runner/main.py --status
    ;;
  feature)
    if [ -z "${2:-}" ]; then
      echo "사용법: eval.sh feature <FEATURE_ID>"
      exit 1
    fi
    python harness/runner/main.py --feature "$2"
    ;;
  dry)
    python harness/runner/main.py --dry-run
    ;;
  *)
    echo "사용법: eval.sh [fast|gate|status|feature <ID>|dry]"
    exit 1
    ;;
esac

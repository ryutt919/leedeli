#!/usr/bin/env python3
"""
lint_eval.py — npm run build (tsc + vite build) 평가자
scaffold, db 카테고리에 사용
"""

import argparse
import sys
from pathlib import Path

try:
    from harness.runner.process_utils import run_capture
except ModuleNotFoundError:
    ROOT = Path(__file__).resolve().parents[2]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from harness.runner.process_utils import run_capture


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="", help="사용 안 함 (호환용)")
    parser.add_argument("--output", required=True, help="결과 로그 파일 경로")
    parser.add_argument("--root", required=True, help="프로젝트 루트 경로")
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    results = []
    overall_ok = True

    for cmd_label, cmd in [
        ("lint", ["npm", "run", "lint"]),
        ("typecheck", ["npm", "run", "typecheck"]),
        ("build", ["npm", "run", "build"]),
    ]:
        print(f"[lint_eval] 실행: {cmd_label}")
        returncode, stdout, stderr = run_capture(
            cmd=cmd,
            cwd=root,
            timeout=120,
            shell=(sys.platform == "win32"),
        )
        ok = returncode == 0
        if not ok:
            overall_ok = False
        status = "PASS" if ok else "FAIL"
        results.append(f"[{status}] {cmd_label}\n{stdout}\n{stderr}\nEXIT_CODE: {returncode}\n")
        print(f"[lint_eval] {cmd_label}: {status}")

    output.write_text("\n".join(results), encoding="utf-8")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()

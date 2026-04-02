#!/usr/bin/env python3
"""
lint_eval.py — npm run build (tsc + vite build) 평가자
scaffold, db 카테고리에 사용
"""

import argparse
import subprocess
import sys
from pathlib import Path


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
        print(f"[lint_eval] running: {cmd_label}")
        result = subprocess.run(
            cmd, cwd=str(root), capture_output=True, text=True, timeout=120,
            shell=(sys.platform == "win32")
        )
        ok = result.returncode == 0
        if not ok:
            overall_ok = False
        status = "PASS" if ok else "FAIL"
        results.append(f"[{status}] {cmd_label}\n{result.stdout}\n{result.stderr}\n")
        print(f"[lint_eval] {cmd_label}: {status}")

    output.write_text("\n".join(results), encoding="utf-8")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()

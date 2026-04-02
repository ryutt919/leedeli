#!/usr/bin/env python3
"""
typecheck_eval.py — tsc --noEmit 평가자
db 카테고리에 사용
"""

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    results = []
    overall_ok = True

    for label, cmd in [
        ("typecheck", ["npm", "run", "typecheck"]),
        ("build", ["npm", "run", "build"]),
    ]:
        r = subprocess.run(
            cmd, cwd=str(root), capture_output=True, text=True, timeout=120,
            shell=(sys.platform == "win32")
        )
        ok = r.returncode == 0
        if not ok:
            overall_ok = False
        status = "PASS" if ok else "FAIL"
        print(f"[typecheck_eval] {label}: {status}")
        results.append(f"[{status}] {label}\n{r.stdout}\n{r.stderr}\nEXIT_CODE: {r.returncode}\n")

    output.write_text("\n".join(results), encoding="utf-8")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()

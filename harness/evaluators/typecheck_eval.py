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

    result = subprocess.run(
        ["npm", "run", "typecheck"],
        cwd=str(root), capture_output=True, text=True, timeout=60,
        shell=(sys.platform == "win32")
    )
    ok = result.returncode == 0
    status = "PASS" if ok else "FAIL"
    print(f"[typecheck_eval] typecheck: {status}")

    out = f"[{status}] typecheck\n{result.stdout}\n{result.stderr}\nEXIT_CODE: {result.returncode}\n"
    output.write_text(out, encoding="utf-8")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

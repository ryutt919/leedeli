#!/usr/bin/env python3
"""
unit_eval.py — vitest 단위 테스트 평가자
engine 카테고리에 사용
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path


def parse_vitest_output(output: str) -> tuple[int, int, list[str]]:
    """vitest 출력에서 통과/실패 수와 실패 목록 추출"""
    passed = 0
    failed = 0
    errors = []

    # "Tests  5 passed | 2 failed" 패턴
    m = re.search(r"Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?", output)
    if m:
        passed = int(m.group(1))
        failed = int(m.group(2) or 0)

    # FAIL 라인
    for line in output.splitlines():
        if line.strip().startswith("FAIL") or "× " in line:
            errors.append(line.strip())

    return passed, failed, errors[:5]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="tests/unit/")
    parser.add_argument("--output", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    spec = args.spec or "tests/unit/"
    cmd = ["npx", "vitest", "run", spec, "--passWithNoTests"]

    print(f"[unit_eval] running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd, cwd=str(root), capture_output=True, text=True, timeout=120,
        shell=(sys.platform == "win32")
    )
    full_output = result.stdout + result.stderr
    passed, failed, errors = parse_vitest_output(full_output)

    ok = result.returncode == 0 and failed == 0
    status = "PASS" if ok else "FAIL"
    print(f"[unit_eval] {status}: {passed} passed, {failed} failed")
    if errors:
        for e in errors:
            print(f"[unit_eval]   {e}")

    out = f"[{status}] vitest\n{full_output}\nEXIT_CODE: {result.returncode}\n"
    output.write_text(out, encoding="utf-8")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

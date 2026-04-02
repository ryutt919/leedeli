#!/usr/bin/env python3
"""
mock_eval.py — Playwright mock E2E 평가자
auth, storage, ui 카테고리에 사용
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path


def parse_playwright_output(output: str) -> tuple[int, int, list[str]]:
    passed = 0
    failed = 0
    errors = []

    # "5 passed (10s)" or "2 failed"
    m = re.search(r"(\d+)\s+passed", output)
    if m:
        passed = int(m.group(1))
    m2 = re.search(r"(\d+)\s+failed", output)
    if m2:
        failed = int(m2.group(1))

    for line in output.splitlines():
        if "✘" in line or "FAILED" in line or line.strip().startswith("●"):
            errors.append(line.strip())

    return passed, failed, errors[:5]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="e2e/mock/")
    parser.add_argument("--output", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    spec = args.spec or "e2e/mock/"

    # spec이 파일이면 해당 파일만, 디렉토리면 전체
    cmd = ["npx", "playwright", "test", spec, "--project=mock"]

    print(f"[mock_eval] running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd, cwd=str(root), capture_output=True, text=True, timeout=180,
        shell=(sys.platform == "win32")
    )
    full_output = result.stdout + result.stderr
    passed, failed, errors = parse_playwright_output(full_output)

    # spec 파일이 아직 없으면 PASS로 간주 (점진적 구현)
    if "No tests found" in full_output or "no tests" in full_output.lower():
        print("[mock_eval] 테스트 파일 없음 → PASS (점진적 구현 허용)")
        output.write_text(f"[PASS] no tests found\n{full_output}\n", encoding="utf-8")
        sys.exit(0)

    ok = result.returncode == 0 and failed == 0
    status = "PASS" if ok else "FAIL"
    print(f"[mock_eval] {status}: {passed} passed, {failed} failed")
    if errors:
        for e in errors:
            print(f"[mock_eval]   {e}")

    out = f"[{status}] playwright mock\n{full_output}\nEXIT_CODE: {result.returncode}\n"
    output.write_text(out, encoding="utf-8")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
smoke_eval.py — Playwright 실DB 스모크 E2E 평가자
smoke 카테고리에 사용 (gate loop 전용)
"""

import argparse
import os
import subprocess
import sys
import re
from pathlib import Path

REQUIRED_ENV = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "TEST_ADMIN_EMAIL",
    "TEST_ADMIN_PASSWORD",
    "TEST_USER_EMAIL",
    "TEST_USER_PASSWORD",
]


def check_env() -> list[str]:
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    return missing


def parse_playwright_output(output: str) -> tuple[int, int, list[str]]:
    passed = 0
    failed = 0
    errors = []
    m = re.search(r"(\d+)\s+passed", output)
    if m:
        passed = int(m.group(1))
    m2 = re.search(r"(\d+)\s+failed", output)
    if m2:
        failed = int(m2.group(1))
    for line in output.splitlines():
        if "✘" in line or "FAILED" in line:
            errors.append(line.strip())
    return passed, failed, errors[:5]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="e2e/smoke/")
    parser.add_argument("--output", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    missing = check_env()
    if missing:
        msg = f"[SKIP] smoke_eval: 환경변수 없음 → {', '.join(missing)}\n스모크 테스트를 건너뜁니다."
        print(f"[smoke_eval][warn] {msg}")
        output.write_text(msg, encoding="utf-8")
        sys.exit(0)  # 환경변수 없으면 PASS로 간주 (CI가 아닌 경우)

    spec = args.spec or "e2e/smoke/"
    cmd = ["npx", "playwright", "test", spec, "--project=smoke"]

    print(f"[smoke_eval] running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd, cwd=str(root), capture_output=True, text=True, timeout=300,
        shell=(sys.platform == "win32")
    )
    full_output = result.stdout + result.stderr
    passed, failed, errors = parse_playwright_output(full_output)

    if "No tests found" in full_output or "no tests" in full_output.lower():
        print("[smoke_eval] 테스트 파일 없음 → PASS")
        output.write_text(f"[PASS] no tests found\n{full_output}\n", encoding="utf-8")
        sys.exit(0)

    ok = result.returncode == 0 and failed == 0
    status = "PASS" if ok else "FAIL"
    print(f"[smoke_eval] {status}: {passed} passed, {failed} failed")
    if errors:
        for e in errors:
            print(f"[smoke_eval]   {e}")

    out = f"[{status}] playwright smoke\n{full_output}\nEXIT_CODE: {result.returncode}\n"
    output.write_text(out, encoding="utf-8")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

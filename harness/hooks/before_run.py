#!/usr/bin/env python3
"""before_run.py — 하네스 실행 전 사전 점검"""

import os
import subprocess
import sys
from pathlib import Path


def before_run(config: dict, loop_mode: str, log_dir: Path) -> None:
    print("[hook:before_run] 사전 점검 시작")

    root = log_dir.parent.parent.parent  # harness/reports/run_xxx → root

    # 1. node_modules 존재 확인
    if not (root / "node_modules").exists():
        print("[hook:before_run] node_modules 없음 → npm install 실행")
        subprocess.run(["npm", "install"], cwd=str(root),
                       shell=(sys.platform == "win32"), check=False)

    # 2. claude CLI 존재 확인
    result = subprocess.run(
        ["claude", "--version"],
        capture_output=True, text=True,
        shell=(sys.platform == "win32")
    )
    if result.returncode != 0:
        print("[hook:before_run][err] claude CLI 없음. 설치: npm install -g @anthropic-ai/claude-code")
        sys.exit(1)

    # 3. .env 파일 확인
    env_file = root / ".env"
    if not env_file.exists():
        print("[hook:before_run][warn] .env 파일 없음. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 필요")

    # 4. smoke loop이면 필수 환경변수 체크
    if loop_mode == "gate":
        required = config.get("smoke_required_env", [])
        missing = [k for k in required if not os.environ.get(k)]
        if missing:
            print(f"[hook:before_run][warn] smoke 환경변수 미설정: {', '.join(missing)}")
            print("[hook:before_run][warn] smoke 테스트는 스킵됩니다.")

    print("[hook:before_run] 사전 점검 완료\n")

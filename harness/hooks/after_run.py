#!/usr/bin/env python3
"""after_run.py — 피처별 실행 후 처리 (git commit, 리포트 생성)"""

import subprocess
import sys
from datetime import datetime
from pathlib import Path

from harness.evaluators.report_generator import generate


def after_run(feature: dict, passed: bool, config: dict, run_log_dir: Path, dry_run: bool = False) -> None:
    root = run_log_dir.parent.parent.parent
    fid = feature["id"]
    run_id = run_log_dir.name

    if dry_run:
        print("[hook:after_run] dry-run -> skip report generation and git commit")
        return

    # 1. 리포트 생성
    eval_log = run_log_dir / f"{fid}_eval.log"
    # 가장 최근 eval 로그 찾기
    logs = sorted(run_log_dir.glob(f"{fid}_*eval.log"))
    if logs:
        eval_log = logs[-1]

    report_path = generate(
        feature=feature,
        passed=passed,
        eval_log=eval_log,
        report_dir=run_log_dir.parent,
        run_id=run_id,
    )
    print(f"[hook:after_run] 리포트 생성: {report_path.name}")

    # 2. git commit (설정에서 활성화된 경우)
    if not config.get("runner", {}).get("enable_git_commit", True):
        return

    try:
        result = subprocess.run(
            ["git", "diff", "--quiet", "HEAD"],
            cwd=str(root), capture_output=True
        )
        has_changes = result.returncode != 0

        if not has_changes:
            print("[hook:after_run] 변경사항 없음, commit 스킵")
            return

        status = "passing" if passed else "failing"
        msg = f"feat({fid}): {feature['name_ascii']} [{status}]"
        subprocess.run(["git", "add", "-A"], cwd=str(root),
                       shell=(sys.platform == "win32"), check=False)
        subprocess.run(["git", "commit", "-m", msg], cwd=str(root),
                       shell=(sys.platform == "win32"), check=False)
        print(f"[hook:after_run] git commit: {msg}")
    except Exception as e:
        print(f"[hook:after_run][warn] git commit 실패: {e}")

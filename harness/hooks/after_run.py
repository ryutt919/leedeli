#!/usr/bin/env python3
"""Post-run hooks: report generation and optional git commit."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from harness.evaluators.report_generator import generate
from harness.runner.run_logger import HarnessLogger


def after_run(
    feature: dict,
    passed: bool,
    config: dict,
    run_log_dir: Path,
    dry_run: bool = False,
    logger: HarnessLogger | None = None,
) -> None:
    root = run_log_dir.parent.parent.parent
    fid = feature["id"]
    run_id = run_log_dir.name

    if dry_run:
        print("[hook:after_run] dry-run -> skip report generation and git commit")
        if logger:
            logger.event("after_run_skipped", feature_id=fid, reason="dry_run")
        return

    eval_log_root = logger.detail_dir if logger else run_log_dir
    eval_log = eval_log_root / f"{fid}_eval.log"
    logs = sorted(eval_log_root.glob(f"{fid}_*eval.log"))
    if logs:
        eval_log = logs[-1]

    report_path = generate(
        feature=feature,
        passed=passed,
        eval_log=eval_log,
        report_dir=run_log_dir.parent,
        run_id=run_id,
    )
    print(f"[hook:after_run] 리포트 생성 완료: {report_path.name}")
    if logger:
        logger.event("report_generated", feature_id=fid, passed=passed, report_path=str(report_path))

    if not config.get("runner", {}).get("enable_git_commit", True):
        if logger:
            logger.event("git_commit_skipped", feature_id=fid, reason="disabled_by_config")
        return

    try:
        result = subprocess.run(
            ["git", "diff", "--quiet", "HEAD"],
            cwd=str(root),
            capture_output=True,
        )
        has_changes = result.returncode != 0

        if not has_changes:
            print("[hook:after_run] 변경 사항이 없어 커밋을 건너뜁니다")
            if logger:
                logger.event("git_commit_skipped", feature_id=fid, reason="no_changes")
            return

        status = "passing" if passed else "failing"
        message = f"feat({fid}): {feature['name_ascii']} [{status}]"
        subprocess.run(
            ["git", "add", "-A"],
            cwd=str(root),
            shell=(sys.platform == "win32"),
            check=False,
        )
        subprocess.run(
            ["git", "commit", "-m", message],
            cwd=str(root),
            shell=(sys.platform == "win32"),
            check=False,
        )
        print(f"[hook:after_run] git 커밋 완료: {message}")
        if logger:
            logger.event("git_commit", feature_id=fid, message=message)
    except Exception as exc:  # pragma: no cover - defensive logging path
        print(f"[hook:after_run][warn] git 커밋 실패: {exc}")
        if logger:
            logger.log("WARN", f"git commit failed for {fid}: {exc}")

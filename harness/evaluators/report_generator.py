#!/usr/bin/env python3
"""
report_generator.py — 하네스 실행 결과 마크다운 리포트 생성
after_run.py에서 호출됨
"""

import json
import re
from datetime import datetime
from pathlib import Path


def generate(
    feature: dict,
    passed: bool,
    eval_log: Path,
    report_dir: Path,
    run_id: str,
) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"{run_id}_{feature['id']}.md"

    eval_output = ""
    if eval_log.exists():
        eval_output = eval_log.read_text(encoding="utf-8", errors="replace")

    # 실패한 테스트 추출
    failures = []
    for line in eval_output.splitlines():
        if any(kw in line for kw in ["FAIL", "✘", "●", "Error", "error:"]):
            failures.append(line.strip())
    failures = failures[:10]

    status_emoji = "✅" if passed else "❌"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        f"# {status_emoji} [{feature['id']}] {feature['name_ascii']}",
        f"",
        f"**실행시각**: {now}  ",
        f"**결과**: {'PASS' if passed else 'FAIL'}  ",
        f"**카테고리**: {feature['category']}  ",
        f"**Sprint**: {feature['sprint']}  ",
        f"",
        f"## Acceptance Criteria",
        "",
    ]
    for c in feature.get("acceptance_criteria", []):
        lines.append(f"- {'✅' if passed else '❌'} {c}")

    if failures:
        lines += ["", "## 실패 내용 (상위 10줄)", "", "```"]
        lines += failures
        lines += ["```"]

    lines += [
        "",
        "## 다음 우선순위",
        "",
        "_(자동 생성 — feature_list.json의 다음 pending/failing 피처 참고)_",
    ]

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path

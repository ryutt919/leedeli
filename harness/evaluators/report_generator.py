#!/usr/bin/env python3
"""
report_generator.py — 하네스 실행 결과 마크다운 리포트 생성
after_run.py에서 호출됨
"""

import re
from datetime import datetime
from pathlib import Path


def extract_failures(eval_output: str, limit: int = 12) -> list[str]:
    patterns = [
        r"\bFAIL\b",
        r"\bfailed\b",
        r"\bFAILED\b",
        r"\bTraceback\b",
        r"\bException\b",
        r"\bError\b",
        r"\berror:\b",
        r"\bAssertionError\b",
        r"\bTypeError\b",
        r"✘",
        r"×",
        r"●",
    ]
    matcher = re.compile("|".join(patterns), re.IGNORECASE)

    failures: list[str] = []
    for line in eval_output.splitlines():
        stripped = line.strip()
        if stripped and matcher.search(stripped):
            failures.append(stripped)
            if len(failures) >= limit:
                break
    return failures


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

    failures = extract_failures(eval_output, limit=12)

    status_emoji = "✅" if passed else "❌"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        f"# {status_emoji} [{feature['id']}] {feature['name_ascii']}",
        f"",
        f"**실행시각**: {now}  ",
        f"**결과**: {'PASS' if passed else 'FAIL'}  ",
        f"**카테고리**: {feature['category']}  ",
        f"**Sprint**: {feature['sprint']}  ",
        f"**평가 로그**: {eval_log}  ",
        f"",
        f"## 인수 기준",
        "",
    ]
    for c in feature.get("acceptance_criteria", []):
        lines.append(f"- {'✅' if passed else '❌'} {c}")

    if failures:
        lines += ["", "## 실패 요약 (상위 12줄)", "", "```"]
        lines += failures
        lines += ["```"]
    elif not passed:
        lines += ["", "## 실패 요약", "", "평가 로그에 명확한 실패 키워드가 없어 원문 로그를 확인하세요."]

    lines += [
        "",
        "## 다음 우선순위",
        "",
        "_(자동 생성 — feature_list.json의 다음 pending/failing 피처 참고)_",
    ]

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path

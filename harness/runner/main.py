#!/usr/bin/env python3
"""
LeeDeli Harness Runner — main.py

사용법:
  python harness/runner/main.py              # 기본 실행 (fast loop)
  python harness/runner/main.py --gate       # gate loop (smoke 포함)
  python harness/runner/main.py --feature S1T1  # 특정 피처만 실행
  python harness/runner/main.py --status     # 현재 상태만 출력
  python harness/runner/main.py --dry-run    # 실제 claude 호출 없이 흐름 확인
"""

import argparse
import json
import os
import subprocess
import sys
import yaml
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
HARNESS = ROOT / "harness"
FEATURE_LIST = ROOT / "feature_list.json"
PROGRESS_FILE = ROOT / "claude-progress.txt"
CONFIG_FILE = HARNESS / "settings" / "config.yaml"
REPORTS_DIR = HARNESS / "reports"

sys.path.insert(0, str(ROOT))

from harness.runner.task_executor import TaskExecutor
from harness.hooks.before_run import before_run
from harness.hooks.after_run import after_run


def load_config() -> dict:
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_features() -> dict:
    with open(FEATURE_LIST, encoding="utf-8") as f:
        return json.load(f)


def save_features(data: dict) -> None:
    with open(FEATURE_LIST, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_next_feature(features: list[dict], target_id: str | None = None) -> dict | None:
    if target_id:
        return next((f for f in features if f["id"] == target_id), None)
    # failing 먼저, 그 다음 pending (priority 오름차순)
    failing = sorted([f for f in features if f["status"] == "failing"], key=lambda x: x["priority"])
    pending = sorted([f for f in features if f["status"] == "pending"], key=lambda x: x["priority"])
    candidates = failing + pending
    return candidates[0] if candidates else None


def all_passing(features: list[dict]) -> bool:
    return all(f["status"] == "passing" for f in features)


def print_status(data: dict) -> None:
    features = data["features"]
    icons = {"pending": "[ ]", "implemented": "[I]", "passing": "[OK]", "failing": "[X]"}
    print(f"\n{'='*55}")
    print(f"  {data['app']} — 피처 현황")
    print(f"{'='*55}")
    for f in sorted(features, key=lambda x: x["priority"]):
        icon = icons.get(f["status"], "?")
        sprint = f"S{f['sprint']}"
        print(f"  {icon} [{f['id']}] {f['name_ascii']} ({f['status']})")
    p = data.get("progress", {})
    print(f"\n  합계: {p.get('passing', 0)}/{p.get('total', len(features))} passing")
    print(f"{'='*55}\n")


def update_progress(data: dict) -> None:
    features = data["features"]
    data["progress"] = {
        "total": len(features),
        "completed": sum(1 for f in features if f["status"] == "passing"),
        "passing": sum(1 for f in features if f["status"] == "passing"),
        "failing": sum(1 for f in features if f["status"] == "failing"),
        "pending": sum(1 for f in features if f["status"] in ("pending", "implemented")),
    }


def update_progress_file(feature_id: str, phase: str, cycle: int, notes: str = "", blocking: str = "없음") -> None:
    now = datetime.now().isoformat()
    content = (
        f"LAST_UPDATED: {now}\n"
        f"CURRENT_FEATURE: {feature_id}\n"
        f"PHASE: {phase}\n"
        f"CYCLE: {cycle}\n"
        f"NOTES: {notes}\n"
        f"BLOCKING: {blocking}\n"
    )
    PROGRESS_FILE.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="LeeDeli Harness Runner")
    parser.add_argument("--gate", action="store_true", help="Gate loop (smoke e2e 포함)")
    parser.add_argument("--feature", help="특정 피처 ID만 실행")
    parser.add_argument("--status", action="store_true", help="현재 상태 출력 후 종료")
    parser.add_argument("--dry-run", action="store_true", help="claude 호출 없이 흐름 확인")
    args = parser.parse_args()

    config = load_config()
    data = load_features()

    if args.status:
        print_status(data)
        return

    loop_mode = "gate" if args.gate else "fast"
    max_cycles = config["runner"]["max_cycles"]
    max_retries = config["runner"]["max_retries"]

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"run_{run_ts}_{loop_mode}"
    run_log_dir = REPORTS_DIR / run_id
    run_log_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[harness] LeeDeli Harness — {loop_mode} loop")
    print(f"[harness] Run ID: {run_id}")
    print_status(data)

    # Pre-run hook
    before_run(config, loop_mode, run_log_dir)

    executor = TaskExecutor(
        config=config,
        root=ROOT,
        harness=HARNESS,
        dry_run=args.dry_run,
        loop_mode=loop_mode,
    )

    cycle = 0
    while True:
        cycle += 1
        if cycle > max_cycles:
            print(f"[harness][err] 최대 사이클({max_cycles}) 초과. 종료.")
            print_status(data)
            sys.exit(1)

        data = load_features()
        feature = get_next_feature(data["features"], args.feature)

        if feature is None:
            if all_passing(data["features"]):
                print("\n[harness][ok] 모든 피처 passing. 완료!")
            else:
                print("\n[harness][ok] 다음 피처 없음. 종료.")
            break

        fid = feature["id"]
        fname = feature["name_ascii"]
        cat = feature["category"]
        print(f"\n{'='*55}")
        print(f"[harness] Cycle {cycle} — [{fid}] {fname} (category: {cat})")
        print(f"{'='*55}")

        update_progress_file(fid, "coding", cycle, f"Cycle {cycle}: {fname} 구현 중")

        # Coding + Evaluation
        success = False
        for attempt in range(1, max_retries + 1):
            print(f"[harness]   attempt {attempt}/{max_retries}")
            coding_log = run_log_dir / f"{fid}_cycle{cycle}_attempt{attempt}_coding.log"
            eval_log = run_log_dir / f"{fid}_cycle{cycle}_attempt{attempt}_eval.log"

            # 1. Coding agent
            coding_ok = executor.run_coding_agent(feature, coding_log)
            if not coding_ok:
                print(f"[harness][warn] Coding agent 실패 (attempt {attempt})")
                continue

            # Mark implemented
            for f in data["features"]:
                if f["id"] == fid:
                    f["status"] = "implemented"
            save_features(data)

            # 2. Evaluate
            passed, eval_output = executor.run_evaluator(feature, eval_log)

            # 3. Update status
            now = datetime.now().isoformat()
            for f in data["features"]:
                if f["id"] == fid:
                    if passed:
                        f["status"] = "passing"
                        f["last_tested"] = now
                        f.pop("failure_reason", None)
                    else:
                        f["status"] = "failing"
                        f["last_tested"] = now
                        f["failure_reason"] = eval_output[:500] if eval_output else "Unknown"

            update_progress(data)
            save_features(data)

            if passed:
                print(f"[harness][ok] [{fid}] PASS")
                success = True
                break
            else:
                print(f"[harness][warn] [{fid}] FAIL (attempt {attempt})")
                if attempt < max_retries:
                    print("[harness]   재시도...")

        update_progress_file(
            fid,
            "passing" if success else "failing",
            cycle,
            f"Cycle {cycle}: {fname} {'완료' if success else '실패'}"
        )

        # Post-run hook (per feature)
        after_run(feature, success, config, run_log_dir)

        # 특정 피처만 실행 모드면 1회 후 종료
        if args.feature:
            break

    # Final report
    data = load_features()
    print_status(data)
    print(f"[harness] 리포트: {run_log_dir}")


if __name__ == "__main__":
    main()

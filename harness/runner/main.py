#!/usr/bin/env python3
"""
LeeDeli harness runner.

Examples:
  python harness/runner/main.py --status
  python harness/runner/main.py --dry-run --agent codex
  python harness/runner/main.py --agent claude
  python harness/runner/main.py --gate --agent codex
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent.parent
HARNESS = ROOT / "harness"
FEATURE_LIST = ROOT / "feature_list.json"
PROGRESS_FILE = ROOT / "claude-progress.txt"
CONFIG_FILE = HARNESS / "settings" / "config.yaml"
REPORTS_DIR = HARNESS / "reports"
LOGS_DIR = HARNESS / "logs"

sys.path.insert(0, str(ROOT))

from harness.hooks.after_run import after_run
from harness.hooks.before_run import before_run
from harness.runner.run_logger import HarnessLogger
from harness.runner.task_executor import TaskExecutor
from harness.runner.usage_guard import UsageGuard


def configure_stdio() -> None:
    """Avoid Windows cp949 crashes when printing Unicode."""
    import os
    
    # Set environment variables for UTF-8
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    os.environ.setdefault("LANG", "C.UTF-8")
    
    # Reconfigure stdout and stderr
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def load_config() -> dict:
    with open(CONFIG_FILE, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_features() -> dict:
    with open(FEATURE_LIST, encoding="utf-8") as handle:
        return json.load(handle)


def save_features(data: dict) -> None:
    with open(FEATURE_LIST, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def sorted_by_priority(features: list[dict]) -> list[dict]:
    return sorted(features, key=lambda item: item["priority"])


def get_next_feature(features: list[dict], target_id: str | None = None) -> dict | None:
    if target_id:
        return next((feature for feature in features if feature["id"] == target_id), None)

    candidates = sorted_by_priority(
        [
            feature
            for feature in features
            if feature["status"] in ("failing", "pending", "implemented")
        ]
    )
    return candidates[0] if candidates else None


def all_passing(features: list[dict]) -> bool:
    return all(feature["status"] == "passing" for feature in features)


def feature_position(features: list[dict], feature_id: str) -> tuple[int, int]:
    ordered = sorted_by_priority(features)
    for index, item in enumerate(ordered, start=1):
        if item["id"] == feature_id:
            return index, len(ordered)
    return 0, len(ordered)


def rel_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def summarize_eval_output(output: str, limit: int = 8) -> list[str]:
    if not output:
        return []

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
    ]
    matcher = re.compile("|".join(patterns), re.IGNORECASE)

    hits = []
    for line in output.splitlines():
        stripped = line.strip()
        if stripped and matcher.search(stripped):
            hits.append(stripped)
            if len(hits) >= limit:
                break

    if hits:
        return hits

    fallback = [line.strip() for line in output.splitlines() if line.strip()]
    return fallback[-limit:]


def print_status(data: dict) -> None:
    features = sorted_by_priority(data["features"])
    icons = {"pending": "[ ]", "implemented": "[I]", "passing": "[OK]", "failing": "[X]"}
    labels = {
        "pending": "대기",
        "implemented": "구현완료",
        "passing": "통과",
        "failing": "실패",
    }

    print(f"\n{'=' * 55}")
    print(f"  {data['app']} 하네스 상태")
    print(f"{'=' * 55}")
    for index, feature in enumerate(features, start=1):
        icon = icons.get(feature["status"], "?")
        label = labels.get(feature["status"], feature["status"])
        print(f"  {index:02d}. {icon} [{feature['id']}] {feature['name_ascii']} ({label})")

    progress = data.get("progress", {})
    print(f"\n  요약: {progress.get('passing', 0)}/{progress.get('total', len(features))} 통과")
    print(f"{'=' * 55}\n")


def update_progress(data: dict) -> None:
    features = data["features"]
    data["progress"] = {
        "total": len(features),
        "completed": sum(1 for feature in features if feature["status"] == "passing"),
        "passing": sum(1 for feature in features if feature["status"] == "passing"),
        "failing": sum(1 for feature in features if feature["status"] == "failing"),
        "pending": sum(1 for feature in features if feature["status"] in ("pending", "implemented")),
    }


def update_progress_file(
    feature_id: str,
    phase: str,
    cycle: int,
    notes: str = "",
    blocking: str = "none",
) -> None:
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


def parse_args(config: dict) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LeeDeli Harness Runner")
    parser.add_argument("--gate", action="store_true", help="Run gate loop including smoke tests")
    parser.add_argument("--feature", help="Run a single feature id only")
    parser.add_argument("--status", action="store_true", help="Print current feature status and exit")
    parser.add_argument("--dry-run", action="store_true", help="Do not invoke the selected agent CLI")

    supported_agents = config.get("runner", {}).get("supported_agents", ["claude", "codex"])
    default_agent = config.get("runner", {}).get("default_agent", supported_agents[0])
    parser.add_argument(
        "--agent",
        choices=supported_agents,
        default=default_agent,
        help=f"Agent CLI to use (default: {default_agent})",
    )
    return parser.parse_args()


def main() -> None:
    configure_stdio()

    config = load_config()
    args = parse_args(config)
    data = load_features()

    if args.status:
        print_status(data)
        return

    loop_mode = "gate" if args.gate else "fast"
    max_cycles = config["runner"]["max_cycles"]
    max_retries = config["runner"]["max_retries"]

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"run_{run_ts}_{loop_mode}_{args.agent}"
    run_report_dir = REPORTS_DIR / run_id
    run_report_dir.mkdir(parents=True, exist_ok=True)
    logger = HarnessLogger(LOGS_DIR, run_id)
    logger.event("run_context", loop_mode=loop_mode, agent=args.agent, dry_run=args.dry_run)

    print(f"\n[하네스] LeeDeli 하네스 :: {loop_mode} 루프")
    print(f"[하네스] 에이전트: {args.agent}")
    print(f"[하네스] 실행 ID: {run_id}")
    print_status(data)
    logger.snapshot_status(data)

    before_run(config, loop_mode, run_report_dir, args.agent, logger=logger)

    usage_guard = UsageGuard(config=config, root=ROOT, agent=args.agent, logger=logger)
    executor = TaskExecutor(
        config=config,
        root=ROOT,
        harness=HARNESS,
        agent=args.agent,
        dry_run=args.dry_run,
        loop_mode=loop_mode,
        logger=logger,
        usage_guard=usage_guard,
    )

    cycle = 0

    def safe_stop(feature_id: str | None, reason: str) -> None:
        target = feature_id or args.feature or "next"
        if not args.dry_run:
            update_progress_file(
                target,
                "paused",
                cycle,
                f"안전중단: {reason}. 재개: python harness/runner/main.py --agent {args.agent}",
                blocking=reason,
            )
        logger.event("safe_stop", feature_id=target, reason=reason, cycle=cycle)
        print(f"[하네스][중단] {reason}")
        current = load_features()
        print_status(current)
        logger.snapshot_status(current)
        print(f"[하네스] 리포트 디렉토리: {run_report_dir}")
        print(f"[하네스] 로그 파일: {logger.run_log_path}")
        sys.exit(0)

    initial_usage = usage_guard.checkpoint("before_run")
    if initial_usage.should_stop:
        safe_stop(args.feature, initial_usage.reason or "usage threshold reached before run")

    while True:
        cycle += 1
        if cycle > max_cycles:
            print(f"[하네스][오류] 최대 사이클 수 {max_cycles}회를 초과했습니다")
            print_status(data)
            logger.log("ERROR", f"max_cycles_exceeded value={max_cycles}")
            sys.exit(1)

        data = load_features()
        feature = get_next_feature(data["features"], args.feature)

        if feature is None:
            if all_passing(data["features"]):
                print("\n[하네스][완료] 모든 피처가 통과했습니다! 🎉")
                logger.log("INFO", "all features are passing")
            else:
                print("\n[하네스][완료] 실행할 후보 피처가 없습니다")
                logger.log("INFO", "no remaining candidate feature")
            break

        feature_id = feature["id"]
        feature_name = feature["name_ascii"]
        category = feature["category"]
        current_index, total_count = feature_position(data["features"], feature_id)

        print(f"\n{'=' * 55}")
        print(
            f"[하네스] 사이클 {cycle} :: 피처 {current_index}/{total_count} "
            f"[{feature_id}] {feature_name} (카테고리: {category})"
        )
        print(f"{'=' * 55}")
        logger.event("cycle_start", cycle=cycle, feature_id=feature_id, feature_name=feature_name, category=category)

        feature_usage = usage_guard.checkpoint("before_feature", feature_id=feature_id)
        if feature_usage.should_stop:
            safe_stop(feature_id, feature_usage.reason or "usage threshold reached before feature")

        if not args.dry_run:
            update_progress_file(feature_id, "coding", cycle, f"사이클 {cycle}: {feature_name} 구현 중")

        success = False
        coding_succeeded_once = False
        for attempt in range(1, max_retries + 1):
            print(f"[하네스]   시도 {attempt}/{max_retries} (피처 {current_index}/{total_count})")
            logger.event("attempt_start", cycle=cycle, feature_id=feature_id, attempt=attempt)
            coding_log = logger.detail_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_coding.log"
            eval_log = logger.detail_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_eval.log"

            attempt_usage = usage_guard.checkpoint("before_attempt", feature_id=feature_id, attempt=attempt)
            if attempt_usage.should_stop:
                safe_stop(feature_id, attempt_usage.reason or "usage threshold reached before attempt")

            if feature["status"] == "implemented":
                print(f"[하네스]   이미 구현됨: 코딩 에이전트 실행을 스킵하고 평가를 진행합니다")
                coding_result = type('obj', (object,), {'ok': True, 'stop_requested': False})()
            else:
                coding_result = executor.run_coding_agent(feature, coding_log, attempt=attempt)

            if coding_result.stop_requested:
                safe_stop(feature_id, coding_result.stop_reason or "agent quota/limit signal detected")
            if not coding_result.ok:
                print(f"[하네스][경고] 코딩 에이전트 실행이 실패했습니다 (시도 {attempt}/{max_retries})")
                logger.event("coding_failed", cycle=cycle, feature_id=feature_id, attempt=attempt)
                continue

            coding_succeeded_once = True

            if not args.dry_run:
                for item in data["features"]:
                    if item["id"] == feature_id:
                        item["status"] = "implemented"
                save_features(data)

            post_agent_usage = usage_guard.checkpoint("after_agent", feature_id=feature_id, attempt=attempt)
            if post_agent_usage.should_stop:
                safe_stop(feature_id, post_agent_usage.reason or "usage threshold reached after agent execution")

            passed, eval_output, eval_usage = executor.run_evaluator(feature, eval_log)
            if eval_usage.should_stop:
                safe_stop(feature_id, eval_usage.reason or "evaluator output reported a limit")

            summary_lines = summarize_eval_output(eval_output) if not passed else []

            if not args.dry_run:
                now = datetime.now().isoformat()
                for item in data["features"]:
                    if item["id"] == feature_id:
                        if passed:
                            item["status"] = "passing"
                            item["last_tested"] = now
                            item.pop("failure_reason", None)
                            item.pop("failure_summary", None)
                            item.pop("last_eval_log", None)
                            item.pop("last_attempt", None)
                        else:
                            item["status"] = "failing"
                            item["last_tested"] = now
                            item["failure_reason"] = (
                                "\n".join(summary_lines)[:1200]
                                if summary_lines
                                else (eval_output[:1200] if eval_output else "평가 출력 없음")
                            )
                            item["failure_summary"] = summary_lines
                            item["last_eval_log"] = rel_path(eval_log)
                            item["last_attempt"] = attempt

                update_progress(data)
                save_features(data)

            if passed:
                print(f"[하네스][성공] 피처 {current_index}/{total_count} [{feature_id}] 통과! (시도 {attempt}회) ✓")
                logger.event("feature_passed", cycle=cycle, feature_id=feature_id, attempt=attempt)
                success = True
                break

            print(f"[하네스][경고] 피처 {current_index}/{total_count} [{feature_id}] 실패 (시도 {attempt}/{max_retries})")
            if summary_lines:
                print("[하네스][평가] 실패 원인 요약:")
                for line in summary_lines:
                    print(f"[하네스][평가] - {line}")
            print(f"[하네스][평가] 상세 로그: {rel_path(eval_log)}")
            logger.event(
                "feature_failed",
                cycle=cycle,
                feature_id=feature_id,
                attempt=attempt,
                summary=summary_lines[:5],
                eval_log=rel_path(eval_log),
            )
            if attempt < max_retries:
                print("[하네스]   재시도합니다...")

        if not coding_succeeded_once:
            if not args.dry_run:
                update_progress_file(
                    feature_id,
                    "blocked",
                    cycle,
                    f"사이클 {cycle}: 코딩 에이전트가 {feature_name}을(를) 실행하지 못했습니다",
                    blocking=f"{args.agent} 코딩 실행 실패",
                )
            logger.event("coding_blocked", cycle=cycle, feature_id=feature_id, agent=args.agent)
            print(f"[하네스][오류] [{feature_id}] 코딩 에이전트 실행 실패로 하네스를 종료합니다")
            sys.exit(1)

        if not args.dry_run:
            update_progress_file(
                feature_id,
                "passing" if success else "failing",
                cycle,
                f"사이클 {cycle}: {feature_name} {'완료' if success else '실패'}",
            )

        after_run(feature, success, config, run_report_dir, dry_run=args.dry_run, logger=logger)

        if args.feature:
            break

    data = load_features()
    print_status(data)
    logger.snapshot_status(data)
    print(f"[하네스] 리포트 디렉토리: {run_report_dir}")
    print(f"[하네스] 로그 파일: {logger.run_log_path}")


if __name__ == "__main__":
    main()

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


def get_next_feature(features: list[dict], target_id: str | None = None) -> dict | None:
    if target_id:
        return next((feature for feature in features if feature["id"] == target_id), None)

    failing = sorted((feature for feature in features if feature["status"] == "failing"), key=lambda item: item["priority"])
    pending = sorted((feature for feature in features if feature["status"] == "pending"), key=lambda item: item["priority"])
    candidates = failing + pending
    return candidates[0] if candidates else None


def all_passing(features: list[dict]) -> bool:
    return all(feature["status"] == "passing" for feature in features)


def print_status(data: dict) -> None:
    features = data["features"]
    icons = {"pending": "[ ]", "implemented": "[I]", "passing": "[OK]", "failing": "[X]"}

    print(f"\n{'=' * 55}")
    print(f"  {data['app']} Harness Status")
    print(f"{'=' * 55}")
    for feature in sorted(features, key=lambda item: item["priority"]):
        icon = icons.get(feature["status"], "?")
        print(f"  {icon} [{feature['id']}] {feature['name_ascii']} ({feature['status']})")

    progress = data.get("progress", {})
    print(f"\n  Summary: {progress.get('passing', 0)}/{progress.get('total', len(features))} passing")
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

    print(f"\n[harness] LeeDeli Harness :: {loop_mode} loop")
    print(f"[harness] Agent: {args.agent}")
    print(f"[harness] Run ID: {run_id}")
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
                f"Safe stop: {reason}. Resume with python harness/runner/main.py --agent {args.agent}",
                blocking=reason,
            )
        logger.event("safe_stop", feature_id=target, reason=reason, cycle=cycle)
        print(f"[harness][stop] {reason}")
        current = load_features()
        print_status(current)
        logger.snapshot_status(current)
        print(f"[harness] Report dir: {run_report_dir}")
        print(f"[harness] Log file: {logger.run_log_path}")
        sys.exit(0)

    initial_usage = usage_guard.checkpoint("before_run")
    if initial_usage.should_stop:
        safe_stop(args.feature, initial_usage.reason or "usage threshold reached before run")

    while True:
        cycle += 1
        if cycle > max_cycles:
            print(f"[harness][err] Max cycles exceeded ({max_cycles}).")
            print_status(data)
            logger.log("ERROR", f"max_cycles_exceeded value={max_cycles}")
            sys.exit(1)

        data = load_features()
        feature = get_next_feature(data["features"], args.feature)

        if feature is None:
            if all_passing(data["features"]):
                print("\n[harness][ok] All features are passing.")
                logger.log("INFO", "all features are passing")
            else:
                print("\n[harness][ok] No remaining candidate feature.")
                logger.log("INFO", "no remaining candidate feature")
            break

        feature_id = feature["id"]
        feature_name = feature["name_ascii"]
        category = feature["category"]

        print(f"\n{'=' * 55}")
        print(f"[harness] Cycle {cycle} :: [{feature_id}] {feature_name} (category: {category})")
        print(f"{'=' * 55}")
        logger.event("cycle_start", cycle=cycle, feature_id=feature_id, feature_name=feature_name, category=category)

        feature_usage = usage_guard.checkpoint("before_feature", feature_id=feature_id)
        if feature_usage.should_stop:
            safe_stop(feature_id, feature_usage.reason or "usage threshold reached before feature")

        if not args.dry_run:
            update_progress_file(feature_id, "coding", cycle, f"Cycle {cycle}: implementing {feature_name}")

        success = False
        coding_succeeded_once = False
        for attempt in range(1, max_retries + 1):
            print(f"[harness]   attempt {attempt}/{max_retries}")
            logger.event("attempt_start", cycle=cycle, feature_id=feature_id, attempt=attempt)
            coding_log = logger.detail_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_coding.log"
            eval_log = logger.detail_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_eval.log"

            attempt_usage = usage_guard.checkpoint("before_attempt", feature_id=feature_id, attempt=attempt)
            if attempt_usage.should_stop:
                safe_stop(feature_id, attempt_usage.reason or "usage threshold reached before attempt")

            coding_result = executor.run_coding_agent(feature, coding_log, attempt=attempt)
            if coding_result.stop_requested:
                safe_stop(feature_id, coding_result.stop_reason or "agent quota/limit signal detected")
            if not coding_result.ok:
                print(f"[harness][warn] Coding agent failed (attempt {attempt})")
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

            if not args.dry_run:
                now = datetime.now().isoformat()
                for item in data["features"]:
                    if item["id"] == feature_id:
                        if passed:
                            item["status"] = "passing"
                            item["last_tested"] = now
                            item.pop("failure_reason", None)
                        else:
                            item["status"] = "failing"
                            item["last_tested"] = now
                            item["failure_reason"] = eval_output[:500] if eval_output else "Unknown"

                update_progress(data)
                save_features(data)

            if passed:
                print(f"[harness][ok] [{feature_id}] PASS")
                logger.event("feature_passed", cycle=cycle, feature_id=feature_id, attempt=attempt)
                success = True
                break

            print(f"[harness][warn] [{feature_id}] FAIL (attempt {attempt})")
            logger.event("feature_failed", cycle=cycle, feature_id=feature_id, attempt=attempt)
            if attempt < max_retries:
                print("[harness]   retrying...")

        if not coding_succeeded_once:
            if not args.dry_run:
                update_progress_file(
                    feature_id,
                    "blocked",
                    cycle,
                    f"Cycle {cycle}: coding agent could not execute {feature_name}",
                    blocking=f"{args.agent} coding invocation failed",
                )
            logger.event("coding_blocked", cycle=cycle, feature_id=feature_id, agent=args.agent)
            print(f"[harness][err] Coding agent could not execute for [{feature_id}]. Stopping harness.")
            sys.exit(1)

        if not args.dry_run:
            update_progress_file(
                feature_id,
                "passing" if success else "failing",
                cycle,
                f"Cycle {cycle}: {feature_name} {'completed' if success else 'failed'}",
            )

        after_run(feature, success, config, run_report_dir, dry_run=args.dry_run, logger=logger)

        if args.feature:
            break

    data = load_features()
    print_status(data)
    logger.snapshot_status(data)
    print(f"[harness] Report dir: {run_report_dir}")
    print(f"[harness] Log file: {logger.run_log_path}")


if __name__ == "__main__":
    main()

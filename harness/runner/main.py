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

sys.path.insert(0, str(ROOT))

from harness.hooks.after_run import after_run
from harness.hooks.before_run import before_run
from harness.runner.task_executor import TaskExecutor


def configure_stdio() -> None:
    """Avoid Windows cp949 crashes when printing Unicode."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


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

    failing = sorted((f for f in features if f["status"] == "failing"), key=lambda x: x["priority"])
    pending = sorted((f for f in features if f["status"] == "pending"), key=lambda x: x["priority"])
    candidates = failing + pending
    return candidates[0] if candidates else None


def all_passing(features: list[dict]) -> bool:
    return all(f["status"] == "passing" for f in features)


def print_status(data: dict) -> None:
    features = data["features"]
    icons = {"pending": "[ ]", "implemented": "[I]", "passing": "[OK]", "failing": "[X]"}

    print(f"\n{'=' * 55}")
    print(f"  {data['app']} Harness Status")
    print(f"{'=' * 55}")
    for feature in sorted(features, key=lambda x: x["priority"]):
        icon = icons.get(feature["status"], "?")
        print(f"  {icon} [{feature['id']}] {feature['name_ascii']} ({feature['status']})")

    progress = data.get("progress", {})
    print(f"\n  Summary: {progress.get('passing', 0)}/{progress.get('total', len(features))} passing")
    print(f"{'=' * 55}\n")


def update_progress(data: dict) -> None:
    features = data["features"]
    data["progress"] = {
        "total": len(features),
        "completed": sum(1 for f in features if f["status"] == "passing"),
        "passing": sum(1 for f in features if f["status"] == "passing"),
        "failing": sum(1 for f in features if f["status"] == "failing"),
        "pending": sum(1 for f in features if f["status"] in ("pending", "implemented")),
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
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"run_{run_ts}_{loop_mode}_{args.agent}"
    run_log_dir = REPORTS_DIR / run_id
    run_log_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[harness] LeeDeli Harness :: {loop_mode} loop")
    print(f"[harness] Agent: {args.agent}")
    print(f"[harness] Run ID: {run_id}")
    print_status(data)

    before_run(config, loop_mode, run_log_dir, args.agent)

    executor = TaskExecutor(
        config=config,
        root=ROOT,
        harness=HARNESS,
        agent=args.agent,
        dry_run=args.dry_run,
        loop_mode=loop_mode,
    )

    cycle = 0
    while True:
        cycle += 1
        if cycle > max_cycles:
            print(f"[harness][err] Max cycles exceeded ({max_cycles}).")
            print_status(data)
            sys.exit(1)

        data = load_features()
        feature = get_next_feature(data["features"], args.feature)

        if feature is None:
            if all_passing(data["features"]):
                print("\n[harness][ok] All features are passing.")
            else:
                print("\n[harness][ok] No remaining candidate feature.")
            break

        feature_id = feature["id"]
        feature_name = feature["name_ascii"]
        category = feature["category"]

        print(f"\n{'=' * 55}")
        print(f"[harness] Cycle {cycle} :: [{feature_id}] {feature_name} (category: {category})")
        print(f"{'=' * 55}")

        if not args.dry_run:
            update_progress_file(feature_id, "coding", cycle, f"Cycle {cycle}: implementing {feature_name}")

        success = False
        for attempt in range(1, max_retries + 1):
            print(f"[harness]   attempt {attempt}/{max_retries}")
            coding_log = run_log_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_coding.log"
            eval_log = run_log_dir / f"{feature_id}_cycle{cycle}_attempt{attempt}_eval.log"

            coding_ok = executor.run_coding_agent(feature, coding_log)
            if not coding_ok:
                print(f"[harness][warn] Coding agent failed (attempt {attempt})")
                continue

            if not args.dry_run:
                for item in data["features"]:
                    if item["id"] == feature_id:
                        item["status"] = "implemented"
                save_features(data)

            passed, eval_output = executor.run_evaluator(feature, eval_log)

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
                success = True
                break

            print(f"[harness][warn] [{feature_id}] FAIL (attempt {attempt})")
            if attempt < max_retries:
                print("[harness]   retrying...")

        if not args.dry_run:
            update_progress_file(
                feature_id,
                "passing" if success else "failing",
                cycle,
                f"Cycle {cycle}: {feature_name} {'completed' if success else 'failed'}",
            )

        after_run(feature, success, config, run_log_dir, dry_run=args.dry_run)

        if args.feature:
            break

    data = load_features()
    print_status(data)
    print(f"[harness] Report dir: {run_log_dir}")


if __name__ == "__main__":
    main()

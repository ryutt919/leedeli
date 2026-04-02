#!/usr/bin/env python3
"""Pre-run checks for the harness."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from harness.runner.run_logger import HarnessLogger


def before_run(config: dict, loop_mode: str, log_dir: Path, agent: str, logger: HarnessLogger | None = None) -> None:
    print("[hook:before_run] starting preflight checks")
    if logger:
        logger.event("before_run_start", loop_mode=loop_mode, agent=agent, log_dir=str(log_dir))

    root = log_dir.parent.parent.parent

    if not (root / "node_modules").exists():
        print("[hook:before_run] node_modules missing -> running npm install")
        if logger:
            logger.log("INFO", "node_modules missing; running npm install")
        subprocess.run(["npm", "install"], cwd=str(root), shell=(sys.platform == "win32"), check=False)

    agent_path = shutil.which(agent)
    if not agent_path:
        print(f"[hook:before_run][err] {agent} CLI is not available on PATH.")
        if logger:
            logger.log("ERROR", f"{agent} CLI is not available on PATH")
        sys.exit(1)

    result = subprocess.run(
        [agent_path, "--version"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        shell=False,
    )
    if result.returncode != 0:
        print(f"[hook:before_run][err] {agent} CLI exists but failed to start.")
        if logger:
            logger.log("ERROR", f"{agent} CLI exists but failed to start")
        sys.exit(1)
    if logger:
        logger.command(
            label="agent_version",
            cmd=[agent_path, "--version"],
            returncode=result.returncode,
            note=(result.stdout or result.stderr).strip(),
        )

    env_file = root / ".env"
    if not env_file.exists():
        print("[hook:before_run][warn] .env not found. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are expected.")
        if logger:
            logger.log("WARN", ".env not found; Supabase env vars may be missing")

    if loop_mode == "gate":
        required = config.get("smoke_required_env", [])
        missing = [key for key in required if not os.environ.get(key)]
        if missing:
            print(f"[hook:before_run][warn] missing smoke env: {', '.join(missing)}")
            print("[hook:before_run][warn] smoke tests may be skipped or fail.")
            if logger:
                logger.event("missing_smoke_env", keys=missing)

    print("[hook:before_run] preflight complete\n")
    if logger:
        logger.event("before_run_complete", loop_mode=loop_mode, agent=agent)

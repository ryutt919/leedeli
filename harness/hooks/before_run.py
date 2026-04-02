#!/usr/bin/env python3
"""Pre-run checks for the harness."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def before_run(config: dict, loop_mode: str, log_dir: Path, agent: str) -> None:
    print("[hook:before_run] starting preflight checks")

    root = log_dir.parent.parent.parent

    if not (root / "node_modules").exists():
        print("[hook:before_run] node_modules missing -> running npm install")
        subprocess.run(["npm", "install"], cwd=str(root), shell=(sys.platform == "win32"), check=False)

    agent_path = shutil.which(agent)
    if not agent_path:
        print(f"[hook:before_run][err] {agent} CLI is not available on PATH.")
        sys.exit(1)

    result = subprocess.run(
        [agent_path, "--version"],
        capture_output=True,
        text=True,
        shell=False,
    )
    if result.returncode != 0:
        print(f"[hook:before_run][err] {agent} CLI exists but failed to start.")
        sys.exit(1)

    env_file = root / ".env"
    if not env_file.exists():
        print("[hook:before_run][warn] .env not found. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are expected.")

    if loop_mode == "gate":
        required = config.get("smoke_required_env", [])
        missing = [key for key in required if not os.environ.get(key)]
        if missing:
            print(f"[hook:before_run][warn] missing smoke env: {', '.join(missing)}")
            print("[hook:before_run][warn] smoke tests may be skipped or fail.")

    print("[hook:before_run] preflight complete\n")

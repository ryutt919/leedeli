#!/usr/bin/env python3
"""Run the selected coding agent and dispatch evaluators."""

from __future__ import annotations

import subprocess
import sys
import shutil
from pathlib import Path


class TaskExecutor:
    def __init__(
        self,
        config: dict,
        root: Path,
        harness: Path,
        agent: str = "claude",
        dry_run: bool = False,
        loop_mode: str = "fast",
    ):
        self.config = config
        self.root = root
        self.harness = harness
        self.agent = agent
        self.dry_run = dry_run
        self.loop_mode = loop_mode
        self.prompts_dir = harness / "prompts"
        self.evaluators_dir = harness / "evaluators"

    def _read_prompt(self, name: str) -> str:
        stem = Path(name).stem
        suffix = Path(name).suffix
        candidates = [
            self.prompts_dir / f"{stem}.{self.agent}{suffix}",
            self.prompts_dir / name,
        ]
        for path in candidates:
            if path.exists():
                return path.read_text(encoding="utf-8")
        return ""

    def _build_agent_command(self, prompt: str) -> list[str]:
        executable = shutil.which(self.agent)
        if not executable:
            raise FileNotFoundError(self.agent)

        if self.agent == "codex":
            return [
                executable,
                "exec",
                "--dangerously-bypass-approvals-and-sandbox",
                "--skip-git-repo-check",
                "-C",
                str(self.root),
                "-",
            ]
        if self.agent == "claude":
            return [executable, "--print", "--dangerously-skip-permissions", prompt]
        raise ValueError(f"Unsupported agent: {self.agent}")

    def run_coding_agent(self, feature: dict, log_path: Path) -> bool:
        coding_prompt = self._read_prompt("coding_prompt.md")
        if not coding_prompt:
            print("[executor][warn] prompts/coding_prompt.md not found")
            return False

        feature_id = feature["id"]
        feature_name = feature["name_ascii"]
        description = feature.get("description", "")
        criteria = feature.get("acceptance_criteria", [])
        criteria_str = "\n".join(f"- {criterion}" for criterion in criteria)

        task_msg = f"""FEATURE_ID: {feature_id}
FEATURE_NAME: {feature_name}
DESCRIPTION: {description}
ACCEPTANCE_CRITERIA:
{criteria_str}

Implement this feature. After implementation, update feature_list.json so this feature becomes "implemented" and refresh claude-progress.txt."""

        full_prompt = f"{coding_prompt}\n\n---\n{task_msg}"

        if self.dry_run:
            print(f"[executor][dry-run] {self.agent} invocation skipped: {feature_id}")
            log_path.write_text(f"[dry-run] agent={self.agent} feature={feature_id}\n", encoding="utf-8")
            return True

        cmd = self._build_agent_command(full_prompt)

        try:
            stdin_input = full_prompt if self.agent == "codex" else None
            result = subprocess.run(
                cmd,
                cwd=str(self.root),
                capture_output=True,
                text=True,
                input=stdin_input,
                timeout=600,
            )
            output = (result.stdout or "") + (result.stderr or "")
            log_path.write_text(output or f"exit_code: {result.returncode}\n", encoding="utf-8")
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print(f"[executor][err] Coding agent timeout: {feature_id}")
            return False
        except FileNotFoundError:
            install_hint = {
                "claude": "npm install -g @anthropic-ai/claude-code",
                "codex": "install Codex CLI and ensure `codex` is on PATH",
            }.get(self.agent, "install the selected agent CLI")
            print(f"[executor][err] '{self.agent}' command not found. Install hint: {install_hint}")
            sys.exit(1)

    def run_evaluator(self, feature: dict, log_path: Path) -> tuple[bool, str]:
        category = feature.get("category", "scaffold")
        evaluator_map = self.config.get("category_evaluator_map", {})
        eval_type = evaluator_map.get(category, "lint")

        if eval_type == "smoke_e2e" and self.loop_mode != "gate":
            print("[executor] smoke_e2e only runs in gate mode. Skipping.")
            return True, "skipped"

        evaluator_script = self.evaluators_dir / f"{eval_type}_eval.py"
        if not evaluator_script.exists():
            print(f"[executor][warn] evaluator not found: {evaluator_script}")
            return False, "evaluator not found"

        test_spec = feature.get("test_spec") or ""

        if self.dry_run:
            print(f"[executor][dry-run] evaluator skipped: {eval_type}_eval.py")
            log_path.write_text("[dry-run]\n", encoding="utf-8")
            return True, "dry-run"

        cmd = [
            sys.executable,
            str(evaluator_script),
            "--spec",
            test_spec,
            "--output",
            str(log_path),
            "--root",
            str(self.root),
        ]

        result = subprocess.run(cmd, cwd=str(self.root), capture_output=True, text=True, timeout=300)
        output = result.stdout + result.stderr
        log_path.write_text(output, encoding="utf-8")
        return result.returncode == 0, output

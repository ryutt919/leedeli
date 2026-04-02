#!/usr/bin/env python3
"""
TaskExecutor — Claude 코딩 에이전트 실행 + 카테고리별 평가자 호출
"""

import subprocess
import sys
from pathlib import Path


class TaskExecutor:
    def __init__(self, config: dict, root: Path, harness: Path, dry_run: bool = False, loop_mode: str = "fast"):
        self.config = config
        self.root = root
        self.harness = harness
        self.dry_run = dry_run
        self.loop_mode = loop_mode
        self.prompts_dir = harness / "prompts"
        self.evaluators_dir = harness / "evaluators"

    def _read_prompt(self, name: str) -> str:
        path = self.prompts_dir / name
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    def run_coding_agent(self, feature: dict, log_path: Path) -> bool:
        """Claude coding agent 실행. 성공 시 True 반환."""
        coding_prompt = self._read_prompt("coding_prompt.md")
        if not coding_prompt:
            print("[executor][warn] prompts/coding_prompt.md 없음")
            return False

        fid = feature["id"]
        fname = feature["name_ascii"]
        desc = feature.get("description", "")
        criteria = feature.get("acceptance_criteria", [])
        criteria_str = "\n".join(f"- {c}" for c in criteria)

        task_msg = f"""FEATURE_ID: {fid}
FEATURE_NAME: {fname}
DESCRIPTION: {desc}
ACCEPTANCE_CRITERIA:
{criteria_str}

위 피처를 구현하세요. 완료 후 feature_list.json의 해당 피처 status를 "implemented"로 변경하고 claude-progress.txt를 업데이트하세요."""

        full_prompt = f"{coding_prompt}\n\n---\n{task_msg}"

        if self.dry_run:
            print(f"[executor][dry-run] claude --print 호출 스킵: {fid}")
            log_path.write_text(f"[dry-run] {fid}\n", encoding="utf-8")
            return True

        cmd = ["claude", "--print", "--dangerously-skip-permissions", full_prompt]

        try:
            result = subprocess.run(
                cmd,
                cwd=str(self.root),
                capture_output=False,
                text=True,
                timeout=600,
            )
            log_path.write_text(f"exit_code: {result.returncode}\n", encoding="utf-8")
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print(f"[executor][err] Coding agent timeout: {fid}")
            return False
        except FileNotFoundError:
            print("[executor][err] 'claude' 명령어 없음. npm install -g @anthropic-ai/claude-code")
            sys.exit(1)

    def run_evaluator(self, feature: dict, log_path: Path) -> tuple[bool, str]:
        """카테고리에 맞는 evaluator 실행. (passed, output) 반환."""
        category = feature.get("category", "scaffold")
        evaluator_map = self.config.get("category_evaluator_map", {})
        eval_type = evaluator_map.get(category, "lint")

        # smoke는 gate loop에서만
        if eval_type == "smoke_e2e" and self.loop_mode != "gate":
            print(f"[executor] smoke_e2e는 gate loop에서만 실행. 스킵.")
            return True, "skipped"

        evaluator_script = self.evaluators_dir / f"{eval_type}_eval.py"
        if not evaluator_script.exists():
            print(f"[executor][warn] evaluator 없음: {evaluator_script}")
            return False, "evaluator not found"

        test_spec = feature.get("test_spec") or ""

        if self.dry_run:
            print(f"[executor][dry-run] evaluator 스킵: {eval_type}_eval.py")
            log_path.write_text("[dry-run]\n", encoding="utf-8")
            return True, "dry-run"

        cmd = [
            sys.executable,
            str(evaluator_script),
            "--spec", test_spec,
            "--output", str(log_path),
            "--root", str(self.root),
        ]

        result = subprocess.run(cmd, cwd=str(self.root), capture_output=True, text=True, timeout=300)
        output = result.stdout + result.stderr

        log_path.write_text(output, encoding="utf-8")
        return result.returncode == 0, output

#!/usr/bin/env python3
"""Run the selected coding agent and dispatch evaluators."""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from harness.runner.process_utils import run_capture
from harness.runner.run_logger import HarnessLogger
from harness.runner.usage_guard import UsageDecision, UsageGuard


@dataclass
class AgentRunResult:
    ok: bool
    stop_requested: bool = False
    stop_reason: str | None = None


class TaskExecutor:
    def __init__(
        self,
        config: dict,
        root: Path,
        harness: Path,
        agent: str = "claude",
        dry_run: bool = False,
        loop_mode: str = "fast",
        logger: HarnessLogger | None = None,
        usage_guard: UsageGuard | None = None,
    ):
        self.config = config
        self.root = root
        self.harness = harness
        self.agent = agent
        self.dry_run = dry_run
        self.loop_mode = loop_mode
        self.prompts_dir = harness / "prompts"
        self.evaluators_dir = harness / "evaluators"
        self.logger = logger
        self.usage_guard = usage_guard

    @staticmethod
    def _build_retry_context(feature: dict) -> str:
        """Build context from previous evaluation failure for retry attempts."""
        summary = feature.get("failure_summary") or []
        reason = feature.get("failure_reason") or ""
        eval_log_path = feature.get("last_eval_log") or ""
        last_attempt = feature.get("last_attempt")

        lines: list[str] = []
        if isinstance(summary, list) and summary:
            lines.append("=" * 60)
            lines.append("이전 평가 실패 요약 (PREVIOUS EVALUATION FAILURE SUMMARY):")
            lines.append("=" * 60)
            for item in summary[:8]:
                lines.append(f"  ✗ {item}")
        elif reason:
            lines.append("=" * 60)
            lines.append("이전 평가 실패 원인:")
            lines.append("=" * 60)
            lines.append(reason[:1000])

        if eval_log_path:
            lines.append(f"\n상세 평가 로그: {eval_log_path}")
            
        if last_attempt:
            lines.append(f"이전 시도 횟수: {last_attempt}")

        if lines:
            lines.append("\n" + "=" * 60)
            lines.append("⚠️  위 실패 원인을 해결한 후 변경사항을 최종 확정하세요.")
            lines.append("=" * 60)

        return "\n".join(lines)

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
            return [executable, "--print", "--dangerously-skip-permissions", "--", prompt]
        if self.agent == "gemini":
            # Gemini CLI command structure (similar to Claude)
            return [executable, "chat", "--non-interactive", "--", prompt]
        raise ValueError(f"지원하지 않는 에이전트: {self.agent}")

    def run_coding_agent(self, feature: dict, log_path: Path, attempt: int | None = None) -> AgentRunResult:
        coding_prompt = self._read_prompt("coding_prompt.md")
        if not coding_prompt:
            print("[실행기][경고] prompts/coding_prompt.md 파일을 찾을 수 없습니다")
            if self.logger:
                self.logger.log("WARN", "prompts/coding_prompt.md not found")
            return AgentRunResult(ok=False)

        feature_id = feature["id"]
        feature_name = feature["name_ascii"]
        description = feature.get("description", "")
        criteria = feature.get("acceptance_criteria", [])
        criteria_str = "\n".join(f"- {criterion}" for criterion in criteria)
        retry_context = self._build_retry_context(feature)
        retry_block = f"\n\n{retry_context}" if retry_context else ""

        task_msg = f"""FEATURE_ID: {feature_id}
FEATURE_NAME: {feature_name}
DESCRIPTION: {description}
ACCEPTANCE_CRITERIA:
{criteria_str}

이 피처를 구현하세요. 구현 후 feature_list.json을 업데이트하여 이 피처를 "implemented" 상태로 변경하고 claude-progress.txt를 갱신하세요.{retry_block}"""

        full_prompt = f"{coding_prompt}\n\n---\n{task_msg}"

        if self.dry_run:
            print(f"[실행기][드라이런] {self.agent} 실행 생략: {feature_id}")
            log_path.write_text(f"[dry-run] agent={self.agent} feature={feature_id}\n", encoding="utf-8")
            if self.logger:
                self.logger.command(label="coding_agent", cmd=["dry-run", self.agent], output_path=log_path)
            return AgentRunResult(ok=True)

        cmd = self._build_agent_command(full_prompt)

        try:
            stdin_input = full_prompt if self.agent == "codex" else None
            if self.logger:
                self.logger.command(label="coding_agent:start", cmd=cmd, output_path=log_path)
            returncode, stdout, stderr = run_capture(
                cmd=cmd,
                cwd=self.root,
                timeout=600,
                input_text=stdin_input,
            )
            output = (stdout or "") + (stderr or "")
            log_path.write_text(output or f"exit_code: {returncode}\n", encoding="utf-8")
            if self.logger:
                self.logger.command(label="coding_agent:end", cmd=cmd, returncode=returncode, output_path=log_path)
            if self.usage_guard:
                decision = self.usage_guard.inspect_output(
                    source="coding_agent",
                    output=output,
                    feature_id=feature_id,
                    attempt=attempt,
                )
                if decision.should_stop:
                    return AgentRunResult(ok=False, stop_requested=True, stop_reason=decision.reason)
            return AgentRunResult(ok=returncode == 0)
        except subprocess.TimeoutExpired:
            print(f"[실행기][오류] 코딩 에이전트 시간 초과: {feature_id}")
            if self.logger:
                self.logger.log("ERROR", f"coding agent timeout for {feature_id}")
            return AgentRunResult(ok=False)
        except FileNotFoundError:
            install_hint = {
                "claude": "npm install -g @anthropic-ai/claude-code",
                "codex": "Codex CLI를 설치하고 PATH에 codex를 등록하세요",
                "gemini": "Google Gemini CLI를 설치하고 PATH에 gemini를 등록하세요 (https://ai.google.dev/gemini-api/docs/cli)",
            }.get(self.agent, "선택한 에이전트 CLI를 설치하세요")
            print(f"[실행기][오류] '{self.agent}' 명령을 찾지 못했습니다. 설치 가이드: {install_hint}")
            sys.exit(1)

    def run_evaluator(self, feature: dict, log_path: Path) -> tuple[bool, str, UsageDecision]:
        category = feature.get("category", "scaffold")
        evaluator_map = self.config.get("category_evaluator_map", {})
        eval_type = evaluator_map.get(category, "lint")

        if eval_type == "smoke_e2e" and self.loop_mode != "gate":
            print("[실행기] smoke_e2e는 gate 모드에서만 실행됩니다. 건너뜁니다.")
            return True, "skipped", UsageDecision()

        evaluator_script = self.evaluators_dir / f"{eval_type}_eval.py"
        if not evaluator_script.exists():
            print(f"[실행기][경고] evaluator 파일이 없습니다: {evaluator_script}")
            if self.logger:
                self.logger.log("WARN", f"evaluator not found: {evaluator_script}")
            return False, "evaluator not found", UsageDecision()

        test_spec = feature.get("test_spec") or ""

        if self.dry_run:
            print(f"[실행기][드라이런] evaluator 실행 생략: {eval_type}_eval.py")
            log_path.write_text("[dry-run]\n", encoding="utf-8")
            if self.logger:
                self.logger.command(label=f"evaluator:{eval_type}", cmd=["dry-run", eval_type], output_path=log_path)
            return True, "dry-run", UsageDecision()

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

        if self.logger:
            self.logger.command(label=f"evaluator:{eval_type}:start", cmd=cmd, output_path=log_path)
        returncode, stdout, stderr = run_capture(
            cmd=cmd,
            cwd=self.root,
            timeout=300,
        )
        output = (stdout or "") + (stderr or "")
        log_path.write_text(output, encoding="utf-8")
        if self.logger:
            self.logger.command(label=f"evaluator:{eval_type}:end", cmd=cmd, returncode=returncode, output_path=log_path)

        decision = UsageDecision()
        if self.usage_guard:
            decision = self.usage_guard.inspect_output(
                source=f"evaluator:{eval_type}",
                output=output,
                feature_id=feature.get("id"),
            )
        return returncode == 0, output, decision

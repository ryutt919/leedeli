#!/usr/bin/env python3
"""Agent CLI usage and quota guardrails."""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from harness.runner.process_utils import run_capture
from harness.runner.run_logger import HarnessLogger

RATE_LIMIT_PATTERNS = (
    "rate limit",
    "usage limit",
    "limit reached",
    "quota exceeded",
    "quota reached",
    "too many requests",
    "please try again later",
    "credit balance is too low",
)


@dataclass
class UsageDecision:
    should_stop: bool = False
    reason: str | None = None
    percent_used: float | None = None
    probe_available: bool = False


class UsageGuard:
    def __init__(self, config: dict, root: Path, agent: str, logger: HarnessLogger) -> None:
        guard_cfg = config.get("runner", {}).get("usage_guard", {})
        self.enabled = guard_cfg.get("enabled", True)
        self.threshold_percent = float(guard_cfg.get("threshold_percent", 95))
        self.checkpoints = guard_cfg.get(
            "checkpoints",
            {
                "before_run": True,
                "before_feature": True,
                "before_attempt": True,
                "after_agent": True,
            },
        )
        self.command_map = guard_cfg.get("commands", {})
        self.root = root
        self.agent = agent
        self.logger = logger

    def checkpoint(self, stage: str, feature_id: str | None = None, attempt: int | None = None) -> UsageDecision:
        if not self.enabled or not self.checkpoints.get(stage, False):
            return UsageDecision()

        decision = UsageDecision()
        agent_commands = self.command_map.get(self.agent, {})
        for probe_name in ("status", "usage"):
            command = agent_commands.get(probe_name)
            if not command:
                continue
            output, returncode = self._run_probe(command, stage, probe_name, feature_id, attempt)
            percent = self._extract_percent_used(output)
            probe_available = percent is not None
            decision.probe_available = decision.probe_available or probe_available
            if probe_available:
                decision.percent_used = percent
                self.logger.event(
                    "usage_probe",
                    agent=self.agent,
                    stage=stage,
                    probe=probe_name,
                    percent_used=percent,
                    feature_id=feature_id,
                    attempt=attempt,
                )
                if percent >= self.threshold_percent:
                    return UsageDecision(
                        should_stop=True,
                        reason=f"{self.agent} reported {percent:.1f}% usage at {stage}",
                        percent_used=percent,
                        probe_available=True,
                    )
            else:
                self.logger.event(
                    "usage_probe",
                    agent=self.agent,
                    stage=stage,
                    probe=probe_name,
                    percent_used=None,
                    feature_id=feature_id,
                    attempt=attempt,
                    note="percentage_not_available",
                    returncode=returncode,
                )

        return decision

    def inspect_output(self, source: str, output: str, feature_id: str | None = None, attempt: int | None = None) -> UsageDecision:
        lowered = output.lower()
        for pattern in RATE_LIMIT_PATTERNS:
            if pattern in lowered:
                reason = f"{self.agent} emitted quota/rate-limit signal during {source}: {pattern}"
                self.logger.event(
                    "usage_limit_signal",
                    agent=self.agent,
                    source=source,
                    pattern=pattern,
                    feature_id=feature_id,
                    attempt=attempt,
                )
                return UsageDecision(should_stop=True, reason=reason)
        return UsageDecision()

    def _run_probe(
        self,
        command: list[str],
        stage: str,
        probe_name: str,
        feature_id: str | None,
        attempt: int | None,
    ) -> tuple[str, int]:
        resolved = command[:]
        executable = shutil.which(resolved[0])
        if executable:
            resolved[0] = executable

        returncode, stdout, stderr = run_capture(
            cmd=resolved,
            cwd=self.root,
            timeout=60,
        )
        output = ((stdout or "") + (stderr or "")).strip()
        suffix = "_".join(
            part
            for part in (
                self.agent,
                stage,
                probe_name,
                feature_id or "global",
                f"attempt{attempt}" if attempt is not None else None,
            )
            if part
        )
        out_path = self.logger.write_probe_output(f"{suffix}.log", output + ("\n" if output else ""))
        self.logger.command(
            label=f"usage_probe:{probe_name}",
            cmd=resolved,
            returncode=returncode,
            output_path=out_path,
        )
        return output, returncode

    def _extract_percent_used(self, output: str) -> float | None:
        if not output:
            return None

        stripped = output.strip()
        parsed: object | None = None
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = None
        if parsed is not None:
            percent = self._extract_percent_from_object(parsed)
            if percent is not None:
                return percent

        regexes = (
            re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*%"),
            re.compile(r"(?P<value>0?\.\d+)\s*(?:used|usage|quota|limit)"),
        )
        for regex in regexes:
            match = regex.search(stripped.lower())
            if not match:
                continue
            value = float(match.group("value"))
            return value * 100 if value <= 1 else value
        return None

    def _extract_percent_from_object(self, value: object) -> float | None:
        if isinstance(value, dict):
            for key, nested in value.items():
                key_lower = key.lower()
                if isinstance(nested, (int, float)):
                    if "percent" in key_lower:
                        return float(nested)
                    if "ratio" in key_lower and ("usage" in key_lower or "used" in key_lower):
                        return float(nested) * 100
                extracted = self._extract_percent_from_object(nested)
                if extracted is not None:
                    return extracted
        elif isinstance(value, list):
            for nested in value:
                extracted = self._extract_percent_from_object(nested)
                if extracted is not None:
                    return extracted
        return None

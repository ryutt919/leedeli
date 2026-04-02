#!/usr/bin/env python3
"""Structured run logging for the harness."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


class HarnessLogger:
    def __init__(self, logs_root: Path, run_id: str) -> None:
        self.run_id = run_id
        self.logs_root = logs_root
        self.logs_root.mkdir(parents=True, exist_ok=True)
        self.detail_dir = self.logs_root / run_id
        self.detail_dir.mkdir(parents=True, exist_ok=True)
        self.run_log_path = self.logs_root / f"{run_id}.log"
        self.log("INFO", f"run_started run_id={run_id}")

    def _append(self, line: str) -> None:
        with self.run_log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")

    def log(self, level: str, message: str) -> None:
        ts = datetime.now().isoformat(timespec="seconds")
        self._append(f"{ts} [{level}] {message}")

    def event(self, name: str, **fields: object) -> None:
        payload = {"event": name, **fields}
        self.log("EVENT", json.dumps(payload, ensure_ascii=False, default=str))

    def command(
        self,
        label: str,
        cmd: list[str],
        returncode: int | None = None,
        output_path: Path | None = None,
        note: str | None = None,
    ) -> None:
        parts = [f"label={label}", f"cmd={json.dumps(cmd, ensure_ascii=False)}"]
        if returncode is not None:
            parts.append(f"returncode={returncode}")
        if output_path is not None:
            parts.append(f"output={output_path}")
        if note:
            parts.append(f"note={note}")
        self.log("COMMAND", " ".join(parts))

    def write_probe_output(self, name: str, content: str) -> Path:
        path = self.detail_dir / name
        path.write_text(content, encoding="utf-8")
        return path

    def snapshot_status(self, data: dict) -> None:
        progress = data.get("progress", {})
        summary = {
            "total": progress.get("total", 0),
            "passing": progress.get("passing", 0),
            "failing": progress.get("failing", 0),
            "pending": progress.get("pending", 0),
        }
        feature_states = {
            feature["id"]: feature["status"]
            for feature in sorted(data.get("features", []), key=lambda item: item["priority"])
        }
        self.event("status_snapshot", summary=summary, features=feature_states)

#!/usr/bin/env python3
"""Subprocess helpers with robust Unicode decoding across platforms."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Mapping


def decode_bytes(data: bytes | None) -> str:
    if not data:
        return ""

    for encoding in ("utf-8", "cp949", "euc-kr"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue

    return data.decode("utf-8", errors="replace")


def build_utf8_env(base: Mapping[str, str] | None = None) -> dict[str, str]:
    env = dict(base or os.environ)
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("LANG", "C.UTF-8")
    return env


def run_capture(
    *,
    cmd: list[str],
    cwd: Path,
    timeout: int,
    shell: bool = False,
    input_text: str | None = None,
    env: Mapping[str, str] | None = None,
) -> tuple[int, str, str]:
    input_bytes = input_text.encode("utf-8") if input_text is not None else None
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=False,
        input=input_bytes,
        timeout=timeout,
        shell=shell,
        env=build_utf8_env(env),
    )

    stdout = decode_bytes(result.stdout)
    stderr = decode_bytes(result.stderr)
    return result.returncode, stdout, stderr

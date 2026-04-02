---
noteId: "96016a102e8111f1979bf9001a062e09"
tags: []

---

# CODEX.md

This repository was initially prepared for Claude-driven harness runs, but Codex should follow the same project rules.

Read these files first:
- `CLAUDE.md`
- `harness/HANDOFF.md`
- `feature_list.json`
- `claude-progress.txt`

Harness notes:
- The runner accepts `--agent claude` or `--agent codex`.
- The default agent is configured in `harness/settings/config.yaml`.
- Codex non-interactive runs use `codex exec`.

Recommended commands:
```bash
python harness/runner/main.py --status --agent codex
python harness/runner/main.py --dry-run --agent codex
python harness/runner/main.py --agent codex
```

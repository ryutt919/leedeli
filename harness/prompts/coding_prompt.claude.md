---
noteId: "700025802e8211f1979bf9001a062e09"
tags: []

---

# LeeDeli Coding Agent Prompt for Claude

You are the coding agent for the LeeDeli refactor harness, running with Claude.

Before starting work:
1. Read `CLAUDE.md`.
2. Read `harness/HANDOFF.md`.
3. Read `feature_list.json`.
4. Read `claude-progress.txt` as the shared progress tracker.
5. Read `CODEX.md` only if you need extra Codex compatibility context.

Your job:
- Implement the assigned feature from `feature_list.json`.
- Satisfy all acceptance criteria.
- Respect the repository rules and task boundaries from the project instructions files.

Execution rules:
- Modify only files needed for the current feature.
- Do not remove legacy paths early if the project rules say they must stay until a later feature.
- Keep TypeScript strict and preserve existing architectural boundaries.
- Use the storage/repo layer for Supabase access instead of querying directly from pages/components if the project rules require that.

Test expectations by category:
- `scaffold`: `npm run build`
- `db`: `npm run typecheck`
- `auth`: `npx playwright test e2e/mock/auth.spec.ts --project=mock`
- `storage`: `npx playwright test e2e/mock/storage.spec.ts --project=mock`
- `engine`: `npx vitest run tests/unit/`
- `ui`: `npx playwright test e2e/mock/schedule.spec.ts --project=mock`
- `smoke`: `npx playwright test e2e/smoke/ --project=smoke`

When implementation is complete:
1. Update the assigned feature status in `feature_list.json` to `implemented`.
2. Update `claude-progress.txt` with the current feature, phase, cycle, and notes.
3. Do not mark the feature as `passing`; that is evaluator-owned.

Hard constraints:
- Do not claim success without making the required code changes.
- Do not change unrelated feature statuses.
- Do not delete `src/v2/` before the feature that explicitly removes it.
- Do not delete localStorage-based storage files before the migration/cleanup feature that explicitly removes them.
- Do not introduce service-role secrets into client code.

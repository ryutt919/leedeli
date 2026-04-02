---
noteId: "66db66002e7211f1979bf9001a062e09"
tags: []

---

# Handoff — 이어받기 문서

**작성일**: 2026-04-02  
**브랜치**: `refactor/harness`  
**현재 상태**: 하네스 구조 초기화 완료. **실제 구현 0건 (S1T1이 첫 번째)**

---

## 완료된 것 (이번 세션)

| 파일 | 설명 |
|---|---|
| `CLAUDE.md` | 프로젝트 규칙, 디렉토리 구조, 코딩 규칙, 하네스 흐름 |
| `feature_list.json` | 7 스프린트 22개 피처 — 전부 `"pending"` |
| `claude-progress.txt` | 진행 스냅샷 |
| `harness/runner/main.py` | 하네스 메인 루프 |
| `harness/runner/task_executor.py` | Claude CLI 호출 + 평가자 디스패치 |
| `harness/evaluators/*.py` | lint, typecheck, unit, mock, smoke, report_generator |
| `harness/hooks/before_run.py` | 환경 사전 점검 |
| `harness/hooks/after_run.py` | git commit + 리포트 생성 |
| `harness/prompts/coding_prompt.md` | Coding Agent 지시 |
| `harness/prompts/evaluator_prompt.md` | Evaluator Agent 지시 |
| `harness/settings/config.yaml` | 하네스 설정 |
| `harness/skills/migrate_ls_to_supabase.py` | localStorage→Supabase 마이그레이션 스크립트 |
| `scripts/eval.sh / test.sh / lint.sh` | 로컬 실행 편의 스크립트 |
| `vitest.config.ts` | vitest 설정 |
| `playwright.config.ts` | Playwright mock/smoke 프로젝트 분리 설정 |
| `package.json` | typecheck, test:unit, test:mock, test:smoke 스크립트 추가 |

---

## 다음 에이전트가 해야 할 것

### 즉시 실행할 명령
```bash
# 브랜치 확인
git branch --show-current  # → refactor/harness

# 의존성 설치 (S1T1)
npm install -D @playwright/test vitest @vitest/ui tsx
npx playwright install chromium
npm run build  # 빌드 통과 확인
```

### 첫 번째 피처부터 하네스 실행
```bash
python harness/runner/main.py --status      # 현재 상태 확인
python harness/runner/main.py --dry-run     # 흐름 확인 (claude 호출 없음)
python harness/runner/main.py               # 실제 실행 (S1T1부터)
```

### 피처 순서 (feature_list.json 기준)
1. **S1T1** (scaffold): Playwright+vitest 의존성 설치, vitest.config.ts/playwright.config.ts 완성
2. **S1T2** (scaffold): package.json 스크립트 검증, harness/settings/config.yaml 완성
3. **S2T1** (db): `src/domain/types.ts` 통합 (현재 3개 파일 → 1개)
4. **S2T2~S2T4** (db): Supabase 마이그레이션 SQL + useAdmin 훅
5. **S3T1~S3T4** (auth): AuthContext + RequireAdmin + 라우트 보호
6. **S4T1~S4T4** (storage): Supabase repos 교체
7. **S5T1~S5T3** (engine): 스케줄 엔진 리뉴얼
8. **S6T1~S6T2** (ui): 반응형 스케줄 UI
9. **S7T1~S7T3** (smoke): Playwright 실DB 스모크

---

## 주의사항
- **반드시 `refactor/harness` 브랜치에서 작업** (main 브랜치 절대 건드리지 말 것)
- `src/v2/` 디렉토리: S6T2 피처 전까지 삭제 금지
- `src/storage/jsonStore.ts` 등 localStorage 파일: S4T4 전까지 삭제 금지
- Supabase SQL 마이그레이션은 `supabase/migrations/` 에 파일로 저장 후 MCP로 적용
- `.env` 파일에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 필요
- smoke 테스트는 `SUPABASE_SERVICE_ROLE_KEY`, `TEST_ADMIN_EMAIL` 등 추가 환경변수 필요

---

## 참고 파일
- 전체 계획: `docs/harness-refactor-plan.md`
- 프로젝트 규칙: `CLAUDE.md`
- 피처 목록/상태: `feature_list.json`

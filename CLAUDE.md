---
noteId: "334db9b02e7111f1979bf9001a062e09"
tags: []

---

# CLAUDE.md — LeeDeli (이델리)

## 프로젝트 개요
- **목적**: 카페 운영 도구 — 스케줄 생성/관리, 재료/프렙 관리, 관리자 권한 통제
- **스택**: Vite + React 19 + TypeScript 5 + Supabase + Ant Design 6 + Playwright + vitest
- **OS**: Windows 11 (bash via Git Bash / WSL)

---

## 디렉토리 구조
```
LeeDeli/
├── CLAUDE.md               ← 이 파일
├── feature_list.json       ← 피처 상태 추적 (pending/implemented/passing/failing)
├── claude-progress.txt     ← 현재 진행 스냅샷
├── src/                    ← 실제 서비스 코드
│   ├── auth/               ← AuthContext, useAdmin, RequireAdmin
│   ├── domain/             ← 통합 타입(types.ts), scheduleEngine.ts
│   ├── storage/            ← Supabase 기반 repos
│   ├── pages/              ← 단일 버전 페이지
│   ├── components/         ← 단일 버전 컴포넌트
│   ├── layouts/
│   └── utils/
├── tests/
│   └── unit/               ← vitest 단위 테스트
├── e2e/
│   ├── mock/               ← Playwright mock 회귀 세트
│   ├── smoke/              ← Playwright 실DB 스모크 세트
│   └── fixtures/           ← 공통 픽스처·helpers
├── supabase/
│   └── migrations/         ← SQL 마이그레이션
├── harness/                ← 하네스 엔지니어링 핵심
│   ├── runner/             ← main.py, task_executor.py
│   ├── specs/              ← 피처별 YAML 명세 (S1T1_*.yaml ...)
│   ├── evaluators/         ← lint_eval.py, unit_eval.py, mock_eval.py, smoke_eval.py
│   ├── hooks/              ← before_run.py, after_run.py
│   ├── prompts/            ← coding_prompt.md, evaluator_prompt.md
│   ├── skills/             ← 재사용 작업 스킬
│   ├── settings/           ← config.yaml (모델/실행 설정)
│   └── reports/            ← 자동 생성 실행 결과
└── scripts/                ← 로컬 실행용 편의 스크립트
    ├── lint.sh
    ├── test.sh
    └── eval.sh
```

---

## 코딩 규칙

### TypeScript 일반
- TypeScript strict mode. `any` 사용 금지 (기존 코드 연동 시 `unknown` 사용 후 타입 좁히기)
- `src/domain/types.ts` 가 유일한 타입 진실 소스. `v2/types.ts`, `types.ts`에서 re-export만 허용
- 함수는 명시적 반환 타입 선언
- `async/await` 우선 사용. Promise chain 금지
- 에러 처리: `try/catch` 내 `console.error` 후 UI에 적절한 에러 상태 전달

### React
- 함수형 컴포넌트 + hooks만 사용
- 상태 관리: 전역은 Context, 로컬은 useState
- 사이드 이펙트는 useEffect에 의존성 배열 명시
- 컴포넌트 파일 1개 = 1개 default export + 필요 시 named export (내부 타입만)

### Supabase
- 클라이언트: `src/utils/supabase.ts`의 `supabase` 싱글턴 사용
- 모든 DB 접근은 `src/storage/` repo 함수를 통해서만 (페이지/컴포넌트에서 직접 supabase 쿼리 금지)
- RLS 정책이 존재하므로 service_role 키는 마이그레이션 스크립트에서만 사용
- 에러 패턴: `const { data, error } = await supabase.from(...).select()` → error 체크 필수

### UI/스타일
- Ant Design 6 컴포넌트 우선 사용 (`antd`)
- 반응형: Ant Design Grid `<Row>`, `<Col>` + breakpoint `lg` (≥992px) = 2패널, `xs`~`md` = 1컬럼
- 기존 `v2-style.css` 톤 유지 (dark/muted 팔레트)
- 인라인 style 금지 (CSS module 또는 className 사용)

### 파일 수정 규칙
- **현재 피처 관련 파일만 수정**. 다른 피처 파일 건드리지 않음
- 기존 파일 삭제 시: 반드시 해당 피처 단계에서만 (feature_list.json 확인)
- import 경로 변경 시 전체 tsc 확인 필수

---

## 테스트 규칙

### vitest (unit)
- 위치: `tests/unit/`
- 실행: `npx vitest run tests/unit/`
- 순수 함수만 테스트 (Supabase/DOM 의존 없음)
- 픽스처: `tests/unit/fixtures/` 에 공통 데이터

### Playwright mock (e2e/mock)
- 실행: `npx playwright test e2e/mock/ --project=mock`
- Supabase API 는 `page.route()` 로 intercept하여 mock 응답 반환
- 인증 mock: `page.route('**/auth/**', ...)` 패턴 사용
- 비주얼 테스트: `await expect(page).toHaveScreenshot()` (첫 실행 시 baseline 생성)

### Playwright smoke (e2e/smoke)
- 실행: `npx playwright test e2e/smoke/ --project=smoke`
- 환경변수 `SUPABASE_SERVICE_ROLE_KEY` 필요 (없으면 스킵)
- 테스트 전용 계정: `TEST_ADMIN_EMAIL`, `TEST_USER_EMAIL` 환경변수
- afterAll에서 테스트 데이터 반드시 정리

### 커버리지 기준
- `src/domain/scheduleEngine.ts`: 80%+
- `src/auth/` 훅: 70%+

---

## feature_list.json 업데이트 규칙

**Coding Agent 작업 완료 후:**
1. 해당 피처 `status` → `"implemented"`
2. `claude-progress.txt` 업데이트

**Evaluator (harness.sh 자동):**
1. 테스트 통과: `status` → `"passing"`, `last_tested` 기록
2. 테스트 실패: `status` → `"failing"`, `failure_reason` 기록
3. `progress` 카운터 갱신

**절대 금지:**
- 테스트 없이 `"passing"` 변경
- 다른 피처 코드 수정

---

## claude-progress.txt 형식
```
LAST_UPDATED: 2026-04-02T00:00:00
CURRENT_FEATURE: S1T1
PHASE: coding|testing|complete
CYCLE: 1
NOTES: Sprint 1 시작. 의존성 설치 중.
BLOCKING: 없음
```

---

## 자동화 하네스 흐름
```
python harness/runner/main.py
    │
    ├─► runner → specs/*.yaml 스캔 → 다음 pending/failing 피처 로드
    │
    ├─► hooks/before_run.py → pre-check (env vars, node_modules 등)
    │
    ├─► task_executor.py → claude (prompts/coding_prompt.md + spec) → 코드 구현
    │
    ├─► evaluators/ → 카테고리별 테스트 실행
    │     scaffold → lint_eval.py  (npm run build)
    │     db       → lint_eval.py  (npm run build + tsc)
    │     auth     → mock_eval.py  (playwright e2e/mock/auth.spec.ts)
    │     storage  → mock_eval.py  (playwright e2e/mock/storage.spec.ts)
    │     engine   → unit_eval.py  (vitest tests/unit/)
    │     ui       → mock_eval.py  (playwright e2e/mock/schedule.spec.ts)
    │     smoke    → smoke_eval.py (playwright e2e/smoke/)
    │
    ├─► feature_list.json 상태 갱신
    │
    ├─► hooks/after_run.py → git commit, 리포트 생성
    │
    └─► 모두 passing? → 종료 : 다음 피처로 반복
```

---

## 완료 기준 (전체)
- [ ] 비관리자 핵심 기능 접근 0건 (mock e2e)
- [ ] 관리자 부여 시나리오 100% (smoke e2e)
- [ ] 스케줄 동적 파라미터 제약 위반 0건 (vitest)
- [ ] 모바일(375px)/데스크탑(1280px) 반응형 (Playwright screenshot)
- [ ] tsc --noEmit 에러 0, npm run build 성공

---

## 주의사항
1. `src/v2/` 디렉토리는 Sprint 6 완료 후 삭제 대상. 그 전에는 건드리지 말 것
2. localStorage repo는 Sprint 4 완료 후 삭제 대상. Git tag `pre-supabase-migration` 필수
3. Supabase SQL은 `supabase/migrations/` 에 파일로 관리. 직접 대시보드 수정 금지
4. 환경변수: `.env` 파일에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 필요

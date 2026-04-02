---
noteId: "c39506c02e6e11f1979bf9001a062e09"
tags: []

---

# Plan: Harness Engineering Refactor — Auth/Admin + Supabase Storage + Schedule Renewal

**Generated**: 2026-04-02  
**Estimated Complexity**: High

---

## Overview

현재 프로젝트는 localStorage 기반 스토리지(v1/v2 혼재), 로그인 체크만 있는 인증, 임시 v2 스케줄 페이지로 운영 중이다.  
이 플랜은 다음 세 축을 동시에 완성하고, Playwright 하네스를 통해 각 단계를 자동 검증한다.

1. **Auth/Admin guard** — 로그인 + 관리자 권한 분리, RLS 강제
2. **Supabase 스토리지 일원화** — localStorage → Supabase (schedules, ingredients, preps)
3. **스케줄 UI/엔진 완전 리뉴얼** — 동적 파라미터, 반응형 2패널 UI
4. **Playwright + CLI 하네스** — mock 회귀 + 실DB 스모크, 자동 리포트

---

## Prerequisites

- Node.js ≥ 18, pnpm/npm
- Supabase 프로젝트 접근권 (service_role key for migrations)
- `.env` 파일: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Playwright 설치 (`npx playwright install`)
- 첫 관리자 계정 (Supabase DB에서 수동 1회 부여)

---

## Project Structure (목표)

```
src/
  auth/           # 인증/인가 훅·컴포넌트·컨텍스트
  storage/        # Supabase 기반 repo (schedules, ingredients, preps, admin)
  domain/         # 타입 통합, 스케줄 엔진
  pages/          # 정리된 단일 버전 페이지
  components/     # 정리된 단일 버전 컴포넌트
tests/
  unit/           # 순수 함수 단위 테스트 (vitest)
e2e/
  mock/           # Playwright mock 회귀 세트
  smoke/          # Playwright 실DB 스모크 세트
  fixtures/       # 공통 픽스처·helpers
harness/
  runner/         # CLI 루프 스크립트 (fast-loop.sh, gate-loop.sh)
  specs/          # 루프별 실행 스펙 목록
  evaluators/     # 결과 파싱·판정 스크립트
  hooks/          # pre/post 훅 (lint, typecheck)
  settings/       # 환경 설정 (harness.config.json)
  reports/        # 자동 생성 리포트 (gitignore 가능)
logs/             # 실행 산출물
artifacts/        # 빌드·스크린샷 등
```

---

## Sprint 1: 기반 구조 및 하네스 스캐폴딩

**Goal**: 테스트 없는 기능 구현은 완료로 간주하지 않으므로, 검증 인프라를 먼저 세운다.  
**Demo/Validation**:
- `npm run harness:fast` 실행 → lint + typecheck 통과
- `npx playwright test e2e/mock/` 실행 → 빈 테스트 스위트 0 failures

### Task 1.1: 의존성 설치
- **Location**: `package.json`
- **Description**: Playwright, vitest, @playwright/test, tsx 설치
  ```
  npm install -D @playwright/test vitest @vitest/ui tsx
  npx playwright install chromium
  ```
- **Acceptance Criteria**:
  - `node_modules/@playwright/test` 존재
  - `node_modules/vitest` 존재
- **Validation**: `npx playwright --version`, `npx vitest --version`

### Task 1.2: 하네스 디렉토리 및 설정 파일 생성
- **Location**: `harness/settings/harness.config.json`, `harness/runner/`
- **Description**: 하네스 설정 파일 및 fast/gate 루프 스크립트 생성
  ```json
  // harness.config.json
  {
    "fastLoop": ["lint", "typecheck", "unit", "mock-e2e"],
    "gateLoop": ["lint", "typecheck", "unit", "mock-e2e", "smoke-e2e"],
    "reportDir": "harness/reports"
  }
  ```
- **Acceptance Criteria**: `harness/` 구조 생성 완료
- **Validation**: `ls harness/`

### Task 1.3: fast-loop.sh 스크립트 작성
- **Location**: `harness/runner/fast-loop.sh`
- **Description**: lint → typecheck → vitest unit → playwright mock e2e 순 실행, 결과를 `harness/reports/YYYY-MM-DD_fast.log`에 저장
- **Acceptance Criteria**: 스크립트 실행 시 각 단계 결과 출력 및 로그 저장
- **Validation**: `bash harness/runner/fast-loop.sh`

### Task 1.4: gate-loop.sh 스크립트 작성
- **Location**: `harness/runner/gate-loop.sh`
- **Description**: fast-loop 전체 + playwright smoke e2e 추가 실행. 실 Supabase 연결 필요.
- **Acceptance Criteria**: `SUPABASE_SERVICE_ROLE_KEY` 환경변수 없으면 스모크 스킵하고 경고 출력
- **Validation**: `bash harness/runner/gate-loop.sh --dry-run`

### Task 1.5: Playwright 설정 파일 작성
- **Location**: `playwright.config.ts`
- **Description**: mock 프로젝트 (MSW/route intercept 기반)와 smoke 프로젝트 (실 Supabase) 분리 설정
  ```ts
  // playwright.config.ts
  projects: [
    { name: 'mock', testDir: 'e2e/mock', ... },
    { name: 'smoke', testDir: 'e2e/smoke', ... },
  ]
  ```
- **Acceptance Criteria**: `npx playwright test --project=mock` 실행 가능
- **Validation**: `npx playwright test --project=mock --list`

### Task 1.6: vitest 설정 파일 작성
- **Location**: `vitest.config.ts`
- **Description**: `tests/unit/` 대상 vitest 설정
- **Acceptance Criteria**: `npm run test:unit` 실행 시 vitest 동작
- **Validation**: `npx vitest run tests/unit/`

### Task 1.7: package.json 스크립트 추가
- **Location**: `package.json`
- **Description**: `test:unit`, `test:mock`, `test:smoke`, `harness:fast`, `harness:gate` 스크립트 추가
- **Acceptance Criteria**: `npm run test:unit` 동작
- **Validation**: `npm run test:unit -- --passWithNoTests`

---

## Sprint 2: 타입 통합 및 Supabase DB 스키마

**Goal**: 세 군데에 흩어진 타입을 `src/domain/types.ts`로 통합하고, Supabase 스키마(admin, schedules, ingredients, preps 테이블 + RLS)를 마이그레이션한다.  
**Demo/Validation**:
- TypeScript 컴파일 에러 0
- Supabase 대시보드에서 테이블/RLS 확인
- `npm run test:unit` 통과

### Task 2.1: 타입 파일 통합
- **Location**: `src/domain/types.ts`
- **Description**: `src/types.ts`, `src/v2/types.ts`, `src/domain/types.ts` 세 파일을 분석해 `src/domain/types.ts` 하나로 통합. 기존 두 파일에서 re-export만 남겨 점진적 마이그레이션.
  - `SavedSchedule` (domain/types.ts의 버전이 최신) 유지
  - `Person`, `StaffConfig`는 v2/types.ts 버전 유지 (우선순위 필드 포함)
  - `Ingredient`, `Prep` 은 domain/types.ts의 최신 버전 유지
- **Dependencies**: 없음
- **Acceptance Criteria**: `tsc --noEmit` 에러 없음
- **Validation**: `npm run build`

### Task 2.2: Supabase SQL 마이그레이션 — admin_users 테이블
- **Location**: `supabase/migrations/001_admin_users.sql`
- **Description**:
  ```sql
  create table public.admin_users (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    granted_by uuid references auth.users(id),
    granted_at timestamptz default now(),
    revoked_at timestamptz,
    unique(user_id)
  );
  -- RLS
  alter table public.admin_users enable row level security;
  create policy "admin can read" on public.admin_users
    for select using (
      exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.revoked_at is null)
    );
  create policy "admin can insert" on public.admin_users
    for insert with check (
      exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.revoked_at is null)
    );
  ```
- **Acceptance Criteria**: Supabase 대시보드에 `admin_users` 테이블 생성, RLS 활성화
- **Validation**: Supabase MCP `execute_sql` 또는 대시보드 확인

### Task 2.3: Supabase SQL 마이그레이션 — schedules, ingredients, preps 테이블
- **Location**: `supabase/migrations/002_core_tables.sql`
- **Description**: `SavedSchedule`, `Ingredient`, `Prep` 구조에 대응하는 Supabase 테이블 생성.  
  모든 테이블에 RLS 적용: 관리자(`admin_users`)만 read/write 가능.
  ```sql
  create table public.schedules (
    id text primary key,
    data jsonb not null,          -- SavedSchedule 전체를 JSON으로 저장 (초기 단순화)
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  -- ingredients, preps 동일 구조
  -- RLS: admin_users 에 있는 user_id만 접근
  ```
  > 초기엔 `data jsonb` 단순화 전략 사용. 이후 컬럼 분리 가능.
- **Acceptance Criteria**: 3개 테이블 생성, RLS 활성화
- **Validation**: Supabase `list_tables` 확인

### Task 2.4: Supabase 헬퍼 함수 — isAdmin()
- **Location**: `src/auth/useAdmin.ts`
- **Description**: `admin_users` 테이블 쿼리로 현재 사용자가 관리자인지 확인하는 훅
  ```ts
  export function useAdmin(): { isAdmin: boolean | null; loading: boolean }
  ```
- **Acceptance Criteria**: 비관리자 계정에서 `isAdmin = false` 반환
- **Validation**: 단위 테스트 `tests/unit/useAdmin.test.ts` (Supabase mock)

---

## Sprint 3: 인증/인가 분리 — RequireAdmin 가드

**Goal**: 로그인 체크(`RequireAuth`)와 관리자 체크(`RequireAdmin`)를 완전히 분리하고, 비관리자는 메뉴·진입점도 보이지 않게 처리한다.  
**Demo/Validation**:
- Playwright mock e2e: 비관리자 `/create` 접근 → `/unauthorized` 리다이렉트
- Playwright mock e2e: 관리자 `/create` 접근 → 정상 렌더

### Task 3.1: AuthContext 생성
- **Location**: `src/auth/AuthContext.tsx`
- **Description**: `session`, `isAdmin`, `loading` 을 전역 공유하는 React Context. `App.tsx`에서 Provider 래핑.
  ```ts
  interface AuthContextValue {
    session: Session | null
    isAdmin: boolean
    loading: boolean
    refreshAdmin: () => Promise<void>
  }
  ```
- **Dependencies**: Task 2.4
- **Acceptance Criteria**: `useAuth()` 훅으로 어디서든 admin 상태 접근 가능
- **Validation**: `tsc --noEmit`

### Task 3.2: RequireAdmin 컴포넌트 생성
- **Location**: `src/auth/RequireAdmin.tsx`
- **Description**: `isAdmin === false`이면 `/unauthorized` 로 리다이렉트, `loading` 중이면 스피너. `RequireAuth`와 별도 분리.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**: 비관리자 접근 시 `/unauthorized` 이동
- **Validation**: Playwright mock test `e2e/mock/auth.spec.ts`

### Task 3.3: UnauthorizedPage 생성
- **Location**: `src/pages/UnauthorizedPage.tsx`
- **Description**: "관리자만 접근 가능합니다" 안내 + 홈 이동 버튼. 기존 UI 톤(Ant Design) 유지.
- **Acceptance Criteria**: `/unauthorized` 라우트 렌더 정상
- **Validation**: 브라우저 확인 또는 Playwright screenshot

### Task 3.4: App.tsx 라우트 보호 업데이트
- **Location**: `src/App.tsx`
- **Description**: `/create`, `/manage`, `/ingredients`, `/preps` 를 `<RequireAdmin>` 으로 감싸기. `<Route path="/unauthorized" ... />` 추가.
- **Dependencies**: Task 3.2, 3.3
- **Acceptance Criteria**: `tsc --noEmit` 통과, 라우트 구조 정상
- **Validation**: `npm run build`

### Task 3.5: BottomNav / HomePage 관리자 메뉴 조건부 표시
- **Location**: `src/components/BottomNav.tsx`, `src/pages/HomePage.tsx`
- **Description**: `useAuth().isAdmin` 이 false이면 `/create`, `/manage`, `/ingredients`, `/preps` 링크 숨김.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**: 비관리자 로그인 시 메뉴에 관리자 기능 없음
- **Validation**: Playwright mock test

### Task 3.6: 관리자 권한 부여 UI — AdminPage
- **Location**: `src/pages/AdminPage.tsx`
- **Description**: 관리자만 접근. Supabase `auth.users` 목록 조회 → 유저 선택 → `admin_users` 에 INSERT. 부여 이력(granted_by, granted_at) 표시.
- **Dependencies**: Task 2.2, 3.1
- **Acceptance Criteria**: 관리자가 다른 유저에게 권한 부여 가능, `admin_users` 에 행 생성
- **Validation**: Playwright smoke test `e2e/smoke/admin-grant.spec.ts`

### Task 3.7: Playwright mock e2e — 인증/인가 시나리오
- **Location**: `e2e/mock/auth.spec.ts`
- **Description**: 아래 시나리오 구현 (Playwright route intercept로 Supabase mock)
  1. 비로그인 → `/login` 리다이렉트
  2. 로그인 + 비관리자 → `/create` 접근 시 `/unauthorized`
  3. 로그인 + 관리자 → `/create` 정상 접근
- **Dependencies**: Task 3.2~3.5
- **Acceptance Criteria**: 3개 시나리오 모두 green
- **Validation**: `npx playwright test e2e/mock/auth.spec.ts`

---

## Sprint 4: Supabase 스토리지 일원화

**Goal**: localStorage 기반 `src/storage/` 및 `src/v2/storage.ts` repos를 Supabase 기반으로 전환한다. 마이그레이션 스크립트로 기존 데이터 보존.  
**Demo/Validation**:
- 재료/프렙/스케줄 CRUD가 Supabase에 반영됨 (대시보드 확인)
- Playwright mock e2e: 재료 목록 조회, 생성, 삭제 green
- `npm run test:unit` 통과

### Task 4.1: Supabase ingredientsRepo 구현
- **Location**: `src/storage/ingredientsRepo.ts` (교체)
- **Description**: localStorage 기반 구현을 Supabase `.from('ingredients')` 기반으로 교체. 인터페이스(함수 시그니처) 동일하게 유지.
  ```ts
  export async function loadIngredients(): Promise<Ingredient[]>
  export async function upsertIngredient(item: Ingredient): Promise<void>
  export async function deleteIngredient(id: string): Promise<void>
  ```
- **Acceptance Criteria**: 기존 `IngredientsPage`가 async 버전으로 정상 동작
- **Validation**: Playwright mock test `e2e/mock/ingredients.spec.ts`

### Task 4.2: Supabase prepsRepo 구현
- **Location**: `src/storage/prepsRepo.ts` (교체)
- **Description**: `loadPreps`, `upsertPrep`, `deletePrep` → Supabase 기반. RLS 적용 확인.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**: PrepsPage 정상 동작
- **Validation**: Playwright mock test

### Task 4.3: Supabase schedulesRepo 구현
- **Location**: `src/storage/schedulesRepo.ts` (교체)
- **Description**: `loadSchedules`, `upsertSchedule`, `deleteSchedule` → Supabase 기반.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**: 스케줄 목록 조회/저장/삭제 Supabase 반영
- **Validation**: Playwright mock test

### Task 4.4: localStorage → Supabase 데이터 마이그레이션 스크립트
- **Location**: `harness/runner/migrate-ls-to-supabase.ts`
- **Description**: 브라우저 localStorage에서 기존 데이터를 Export → JSON → Supabase INSERT 스크립트. CLI: `npx tsx harness/runner/migrate-ls-to-supabase.ts --dry-run`
- **Acceptance Criteria**: dry-run 시 기존 데이터 수 출력, 실행 시 Supabase에 행 생성
- **Validation**: dry-run 실행 후 수동 확인

### Task 4.5: v2/storage.ts 및 구버전 repos 정리
- **Location**: `src/v2/storage.ts`, `src/storage/jsonStore.ts`, `src/storage/keys.ts`
- **Description**: Supabase repos 전환 완료 후, localStorage 기반 파일들을 삭제 또는 deprecated 처리. `tsc --noEmit` 에러 없이.
- **Dependencies**: Task 4.1~4.3
- **Acceptance Criteria**: `tsc --noEmit` 에러 0
- **Validation**: `npm run build`

### Task 4.6: Playwright mock e2e — 스토리지 시나리오
- **Location**: `e2e/mock/storage.spec.ts`
- **Description**: 재료 CRUD, 프렙 CRUD, 스케줄 목록 로드 시나리오 (route intercept mock)
- **Acceptance Criteria**: 5개 이상 시나리오 green
- **Validation**: `npx playwright test e2e/mock/storage.spec.ts`

---

## Sprint 5: 스케줄 엔진 리뉴얼

**Goal**: 동적 파라미터를 지원하는 새 스케줄 엔진을 `src/domain/scheduleEngine.ts`에 구현한다. 알고리즘 단계를 명확히 분리하고 제약 위반을 표준 오류 타입으로 반환한다.  
**Demo/Validation**:
- `npm run test:unit` 스케줄 엔진 단위 테스트 green
- 제약 위반 시 `ConstraintError[]` 반환 확인

### Task 5.1: ScheduleParams 타입 정의
- **Location**: `src/domain/types.ts`
- **Description**: 동적 입력 파라미터 타입 추가
  ```ts
  export type ScheduleParams = {
    startDateISO: string
    endDateISO: string
    staff: StaffMember[]
    dailyRequiredByDate: Record<string, number>  // 날짜별 필요 인원
    workHours: number         // 근무시간 (기본 8)
    breakHours: number        // 휴게시간 (기본 1)
    requests: DayRequest[]    // 휴무/반차 요청
    constraints?: ScheduleConstraint[]  // 추가 제약
  }

  export type ConstraintError = {
    type: 'UNDERSTAFFED' | 'OVERSTAFFED' | 'CONSTRAINT_VIOLATION' | 'NO_OPENER' | 'NO_CLOSER'
    dateISO: string
    detail: string
  }
  ```
- **Acceptance Criteria**: 타입 컴파일 통과
- **Validation**: `tsc --noEmit`

### Task 5.2: 후보 생성 단계 구현 (CandidateGenerator)
- **Location**: `src/domain/scheduleEngine.ts`
- **Description**: `generateCandidates(params: ScheduleParams): CandidateAssignment[]` — 각 날짜에 대해 가능한 직원 배정 조합 후보 생성. 휴무/반차 요청 반영.
- **Acceptance Criteria**: 단위 테스트 — 휴무 요청 직원이 후보에서 제외됨
- **Validation**: `tests/unit/scheduleEngine.candidates.test.ts`

### Task 5.3: 제약 필터링 단계 구현 (ConstraintFilter)
- **Location**: `src/domain/scheduleEngine.ts`
- **Description**: `filterByConstraints(candidates: CandidateAssignment[], params: ScheduleParams): CandidateAssignment[]` — 오픈/마감 필수 직원, 불가 배정 필터.
- **Acceptance Criteria**: mustOpen 직원이 오픈 배정에만 포함됨
- **Validation**: `tests/unit/scheduleEngine.filter.test.ts`

### Task 5.4: 배정 단계 구현 (Assigner)
- **Location**: `src/domain/scheduleEngine.ts`
- **Description**: `assignSchedule(filtered: CandidateAssignment[], params: ScheduleParams): ScheduleAssignment[]` — 우선순위·공평성 기반 배정. 기존 `v2/generator.ts` 로직 흡수.
- **Acceptance Criteria**: 전체 기간 배정 완료, 공평성 지표(표준편차) < 1.5
- **Validation**: `tests/unit/scheduleEngine.assign.test.ts`

### Task 5.5: 사후 검증 단계 구현 (PostValidator)
- **Location**: `src/domain/scheduleEngine.ts`
- **Description**: `validateAssignment(assignments: ScheduleAssignment[], params: ScheduleParams): ConstraintError[]` — 기존 `validateGeneratedSchedule` 리팩터. 표준 `ConstraintError[]` 반환.
- **Acceptance Criteria**: 인원 미달 날짜에 `UNDERSTAFFED` 에러 포함
- **Validation**: `tests/unit/scheduleEngine.validate.test.ts`

### Task 5.6: 공개 API — generateSchedule()
- **Location**: `src/domain/scheduleEngine.ts`
- **Description**: 4단계를 조합한 공개 함수
  ```ts
  export function generateSchedule(params: ScheduleParams): {
    schedule: SavedSchedule
    errors: ConstraintError[]
  }
  ```
- **Acceptance Criteria**: 에러 0인 경우 정상 스케줄 반환; 에러 있을 시 `errors` 비어있지 않음
- **Validation**: 통합 단위 테스트 `tests/unit/scheduleEngine.integration.test.ts`

### Task 5.7: v2/generator.ts 및 구버전 엔진 파일 정리
- **Location**: `src/v2/generator.ts`, `src/generator.ts`, `src/domain/scheduleEngine.ts` (기존)
- **Description**: 신규 엔진으로 전환 후 구버전 삭제. `tsc --noEmit` 에러 없이.
- **Dependencies**: Task 5.6
- **Acceptance Criteria**: 구버전 엔진 파일 제거, 빌드 통과
- **Validation**: `npm run build`

---

## Sprint 6: 스케줄 UI 리뉴얼 — 반응형 2패널

**Goal**: 기존 v2 스케줄 페이지를 완전 교체. 데스크탑 2패널(왼쪽: 파라미터 입력 / 오른쪽: 결과 미리보기), 모바일 1컬럼.  
**Demo/Validation**:
- 데스크탑(1280px) Playwright screenshot → 2패널 레이아웃 확인
- 모바일(375px) Playwright screenshot → 1컬럼 레이아웃 확인
- 스케줄 생성 후 Supabase 저장 확인

### Task 6.1: CreateSchedulePage 레이아웃 컴포넌트
- **Location**: `src/pages/CreateSchedulePage.tsx` (완전 교체)
- **Description**: CSS Grid/Flexbox 기반 반응형 2패널 레이아웃.
  ```
  [데스크탑]          [모바일]
  | 파라미터 | 미리보기 |   | 파라미터 |
  |         |          |   | 미리보기 |
  ```
  Ant Design Grid 사용. breakpoint: `lg` (≥992px) = 2패널.
- **Dependencies**: Task 5.6 (새 엔진)
- **Acceptance Criteria**: 브레이크포인트 전환 시 레이아웃 정상
- **Validation**: Playwright visual test (screenshot diff)

### Task 6.2: ScheduleParamsPanel 컴포넌트
- **Location**: `src/components/schedule/ScheduleParamsPanel.tsx`
- **Description**: 스케줄 파라미터 입력 패널. 기간 선택, 직원 목록, 일자별 필요 인원, 근무/휴게시간, 요청 입력. 기존 v2 CreateSchedulePage 로직 추출.
- **Acceptance Criteria**: 모든 `ScheduleParams` 필드 입력 가능
- **Validation**: 단위 테스트 또는 Playwright interaction test

### Task 6.3: SchedulePreviewPanel 컴포넌트
- **Location**: `src/components/schedule/SchedulePreviewPanel.tsx`
- **Description**: 생성된 스케줄 시각화 (달력 또는 테이블). 제약 에러 하이라이트. 기존 v2 결과 뷰 추출.
- **Acceptance Criteria**: `ConstraintError` 있는 날짜 시각적 강조
- **Validation**: Playwright screenshot

### Task 6.4: ManageSchedulesPage 반응형 개선
- **Location**: `src/pages/ManageSchedulesPage.tsx` (완전 교체)
- **Description**: 스케줄 목록(왼쪽) + 상세(오른쪽) 2패널. 모바일은 목록 → 상세 드릴다운.
- **Acceptance Criteria**: 데스크탑/모바일 모두 정상 동작
- **Validation**: Playwright visual test

### Task 6.5: v2 페이지 파일 정리
- **Location**: `src/pages/v2/`, `src/components/v2/`
- **Description**: 신규 페이지/컴포넌트로 전환 후 v2 디렉토리 삭제. App.tsx import 정리.
- **Dependencies**: Task 6.1~6.4
- **Acceptance Criteria**: `src/pages/v2/`, `src/components/v2/` 디렉토리 없음
- **Validation**: `npm run build`

### Task 6.6: Playwright mock e2e — 스케줄 UI 시나리오
- **Location**: `e2e/mock/schedule.spec.ts`
- **Description**:
  1. 스케줄 생성 파라미터 입력 → 생성 클릭 → 결과 표시
  2. 제약 위반 시 에러 메시지 표시
  3. 스케줄 저장 → 목록 페이지에서 확인
- **Acceptance Criteria**: 3개 시나리오 green
- **Validation**: `npx playwright test e2e/mock/schedule.spec.ts`

---

## Sprint 7: Playwright 실DB 스모크 세트 + 하네스 완성

**Goal**: 실 Supabase 연결로 권한과 핵심 흐름을 검증하는 스모크 E2E를 작성하고, 하네스 리포트 자동 생성을 완성한다.  
**Demo/Validation**:
- `bash harness/runner/gate-loop.sh` 전체 통과
- `harness/reports/` 에 리포트 파일 생성

### Task 7.1: 스모크 테스트용 Supabase 픽스처
- **Location**: `e2e/fixtures/supabase.ts`
- **Description**: 테스트용 관리자/비관리자 계정 생성·삭제, 테스트 데이터 시드/정리 헬퍼.
- **Acceptance Criteria**: 픽스처 사용 시 테스트 격리 보장
- **Validation**: 픽스처 import 가능, TypeScript 에러 없음

### Task 7.2: 스모크 E2E — 로그인/세션 유지
- **Location**: `e2e/smoke/session.spec.ts`
- **Description**: 실 Supabase 로그인 → 새로고침 후 세션 유지 확인
- **Acceptance Criteria**: green
- **Validation**: `npx playwright test e2e/smoke/session.spec.ts`

### Task 7.3: 스모크 E2E — 관리자 권한 부여
- **Location**: `e2e/smoke/admin-grant.spec.ts`
- **Description**: 관리자가 비관리자에게 권한 부여 → 권한 부여된 계정으로 로그인 → 관리자 기능 접근 가능
- **Acceptance Criteria**: green
- **Validation**: `npx playwright test e2e/smoke/admin-grant.spec.ts`

### Task 7.4: 스모크 E2E — 재료/프렙 관리자 접근
- **Location**: `e2e/smoke/data-access.spec.ts`
- **Description**: 관리자 재료 추가/수정/삭제 → Supabase 반영; 비관리자 접근 시 차단
- **Acceptance Criteria**: green
- **Validation**: `npx playwright test e2e/smoke/data-access.spec.ts`

### Task 7.5: 스모크 E2E — 스케줄 생성/관리
- **Location**: `e2e/smoke/schedule-flow.spec.ts`
- **Description**: 스케줄 파라미터 입력 → 생성 → Supabase 저장 → 목록 확인 → 수정
- **Acceptance Criteria**: green
- **Validation**: `npx playwright test e2e/smoke/schedule-flow.spec.ts`

### Task 7.6: harness/evaluators/report-generator.ts 작성
- **Location**: `harness/evaluators/report-generator.ts`
- **Description**: 각 루프 실행 결과(exit code, 출력)를 파싱해 `harness/reports/YYYY-MM-DD_HH-MM_{fast|gate}.md` 리포트 생성.
  - 실패 분류: lint/typecheck/unit/mock-e2e/smoke-e2e 별 집계
  - 다음 우선순위 자동 제안 (실패한 테스트 목록 기반)
- **Acceptance Criteria**: 리포트 파일 생성, 실패 분류 정확
- **Validation**: 샘플 로그로 dry-run

### Task 7.7: 최종 gate-loop.sh 통합 검증
- **Location**: `harness/runner/gate-loop.sh`
- **Description**: 전체 파이프라인 실행 — lint → typecheck → unit → mock e2e → smoke e2e → 리포트 생성
- **Acceptance Criteria**: 전체 green, `harness/reports/` 에 리포트 생성
- **Validation**: `bash harness/runner/gate-loop.sh`

---

## Testing Strategy

| 레이어 | 도구 | 위치 | 목적 |
|---|---|---|---|
| Unit | vitest | `tests/unit/` | 엔진 순수 함수, 타입 변환 |
| Mock E2E | Playwright (route intercept) | `e2e/mock/` | UI 흐름, 빠른 회귀 |
| Smoke E2E | Playwright (실 Supabase) | `e2e/smoke/` | 권한, 실 데이터 흐름 |

**Fast loop**: lint + typecheck + unit + mock e2e (~30초 목표)  
**Gate loop**: fast loop + smoke e2e (~2분 목표)

---

## Potential Risks & Gotchas

1. **타입 통합 충돌**: `v2/types.ts`의 `Person`과 `domain/types.ts`의 `StaffMember`가 다른 구조. 통합 시 API 호환성 깨질 수 있음. → re-export 브릿지 패턴으로 점진적 마이그레이션.

2. **Supabase RLS + 관리자 부트스트래핑**: 첫 관리자는 RLS를 우회해야 INSERT 가능. → `service_role` 키로 첫 1회만 수동 SQL 실행. RLS policy에 `service_role` 예외 추가.

3. **localStorage 마이그레이션 데이터 손실**: 브라우저마다 localStorage 내용이 다름. → 마이그레이션 스크립트를 "export JSON from browser console → import via script" 방식으로 설계.

4. **v2/generator.ts와 신규 엔진 과도기**: v2 페이지가 v2/generator를 직접 import. Sprint 5 완료 전까지 v2 페이지는 그대로 유지하고, Sprint 6에서 한 번에 교체.

5. **Playwright 스모크 테스트 격리**: 실 Supabase 데이터 오염 위험. → 테스트 전용 이메일 계정 + 테스트 후 데이터 정리 픽스처 필수.

6. **반응형 레이아웃 Ant Design v6 호환**: antd 6.x의 Grid API가 v5와 다를 수 있음. → Context7로 최신 antd docs 확인 후 작업.

7. **스케줄 데이터 Supabase JSONB 저장**: 초기 단순화지만, 쿼리 성능 문제 발생 시 컬럼 분리 필요. Sprint 4에서 JSONB로 시작, 필요 시 마이그레이션.

---

## Rollback Plan

- **Sprint 1~2**: 새 파일만 추가, 기존 코드 무수정 → 그냥 삭제하면 원복
- **Sprint 3**: `RequireAdmin` 추가 전 App.tsx에서 제거하면 원복
- **Sprint 4**: localStorage repos를 삭제하기 전 Git tag `pre-supabase-migration` 생성
- **Sprint 5**: 엔진 교체 전 Git tag `pre-engine-renewal` 생성
- **Sprint 6**: v2 페이지 삭제 전 Git tag `pre-ui-renewal` 생성

---

## 완료 기준 체크리스트

- [ ] 비관리자 핵심 기능 접근 0건 (Playwright mock e2e 검증)
- [ ] 관리자 부여 시나리오 100% 통과 (Playwright smoke 검증)
- [ ] 스케줄 동적 파라미터 제약 위반 0건 (vitest 검증)
- [ ] 모바일(375px)/데스크탑(1280px) 반응형 레이아웃 정상 (Playwright screenshot)
- [ ] Playwright mock 회귀 전체 green
- [ ] Playwright 실DB 스모크 전체 green
- [ ] `harness/reports/` 에 리포트 자동 생성
- [ ] `tsc --noEmit` 에러 0, `npm run build` 성공

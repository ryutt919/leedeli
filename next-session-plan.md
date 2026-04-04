---
noteId: "c82dec502fcd11f19698f9244b6ca491"
tags: []

---

# LeeDeli 다음 세션 실행 계획

**작성일**: 2026-04-04  
**브랜치**: `refactor/harness`  
**기준**: v4.3 안정화 완료 이후 (19/19 mock E2E 통과, build 통과)

---

## 작업 범위 요약

| 우선순위 | 항목 | 카테고리 |
|----------|------|----------|
| P1 | 초기 로딩 지연 제거 + 로그인 화면 자동 표시 | UX / auth |
| P1 | 수동 로그인 버튼 추가 (헤더/홈) | UI |
| P1 | 하네스 Generator / Evaluator 분리 재구성 | harness |
| P2 | preps 스키마 통일 (data jsonb 단일화) | db / storage |
| P3 | src/v2/ 디렉토리 삭제 | scaffold |
| P4 | smoke E2E 실 DB 검증 | smoke |

---

## P1-A. 초기 로딩 지연 제거 + 로그인 자동 표시

### 현상
- 앱 최초 진입 시 빈 화면 / Spinner가 수 초간 표시됨
- 비로그인 상태임에도 로그인 페이지로 즉시 이동하지 않음

### 근본 원인
`RequireAuth`가 `loading=true` 동안 `<Spin />` 표시. `loading`은 `AuthContext.init()`의
`getSession()` 완료 전까지 `true`이므로 Supabase JS SDK 초기화 시간만큼 spinner가 보임.

실제 `getSession()`은 localStorage 읽기(< 50ms)이지만, **프로덕션 번들(1985KB)**의 초기
파싱/실행 시간이 길어 체감 로딩이 길어짐.

### 수정 계획

**1. 코드 스플리팅 도입 (vite.config.ts)**
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-ant': ['antd', '@ant-design/icons'],
        'vendor-supabase': ['@supabase/supabase-js'],
      },
    },
  },
}
```
목표: 초기 청크 < 400KB, 나머지는 route 단위 lazy load.

**2. RequireAuth 로딩 전략 개선**
```typescript
// 현재: loading=true → Spin 표시
// 수정: session=null(확정)이면 즉시 /login으로 redirect
//       loading 중에는 아무것도 렌더하지 않음 (null 반환)

if (loading) return null  // spinner 대신 빈 화면 → 화면 깜빡임 없음
if (!session) return <Navigate to="/login" state={{ from: location }} replace />
```

또는 더 근본적 개선: **AuthContext에 `sessionChecked` 플래그 추가**
```typescript
// init() 완료 즉시 sessionChecked=true
// RequireAuth: sessionChecked 전엔 null, 이후엔 session 여부로 분기
```

**3. 이미 로그인된 경우 로그인 페이지 자동 회피**  
→ 이미 구현됨 (`LoginPage`에 `if (session) return <Navigate to="/" />`)

### 검증 명령
```bash
npm run build          # 번들 크기 확인
npm run test:mock      # 전체 mock E2E 통과 확인 (auth 포함)
```

---

## P1-B. 수동 로그인 버튼 추가

### 현상
- 로그인 화면은 자동 redirect로만 진입 가능
- 사용자가 의도적으로 로그인 화면으로 갈 방법이 없음

### 수정 위치 및 계획

**1. MobileShell 헤더 우측 (비로그인 시 표시)**
```typescript
// src/layouts/MobileShell.tsx
// 헤더 right 영역에 auth 상태 기반 버튼 추가
const { session } = useAuth()

// 비로그인: "로그인" 버튼
// 로그인: "로그아웃" 버튼 또는 사용자 아이콘
const authButton = session
  ? <Button onClick={() => supabase.auth.signOut()}>로그아웃</Button>
  : <Button onClick={() => navigate('/login')}>로그인</Button>
```

**2. HomePage 하단 (비로그인 접근 불가하므로 적용 X)**  
→ `/#/` 자체가 RequireAuth로 보호됨. 로그인 버튼은 **MobileShell 헤더**에만 추가.

**3. UnauthorizedPage 기존 "로그인" 버튼 유지**  
→ 이미 존재. 그대로 유지.

### 검증 명령
```bash
npm run test:mock      # auth + auth-flow 전체 통과 확인
```

---

## P1-C. 하네스 Generator / Evaluator 분리 재구성

### 현재 상태
- `harness/prompts/coding_prompt.md` : 코딩 에이전트 지침
- `harness/prompts/evaluator_prompt.md` : 평가 에이전트 지침
- 두 역할이 같은 디렉토리에 혼재, spec ↔ prompt 연결이 명시적이지 않음

### 분리 구조 설계

```
harness/
├── prompts/
│   ├── generator_prompt.md        ← 신규: Generator 전용 (spec → 코드 구현)
│   ├── evaluator_prompt.md        ← 기존 유지 + 강화
│   └── coding_prompt.md           ← 하위 호환 유지 (deprecated 표시)
├── specs/
│   ├── S8T1_loading_fix.yaml      ← 신규 피처 spec
│   ├── S8T2_preps_schema.yaml     ← 신규 피처 spec
│   ├── S9T1_cleanup_v2.yaml       ← 신규 피처 spec
│   └── S10T1_smoke_e2e.yaml       ← 신규 피처 spec
├── evaluators/
│   ├── lint_eval.py               ← 기존
│   ├── mock_eval.py               ← 기존
│   ├── smoke_eval.py              ← 기존
│   ├── unit_eval.py               ← 기존
│   └── report_generator.py        ← 기존
└── runner/
    └── main.py                    ← 기존
```

### generator_prompt.md 핵심 내용
```markdown
# LeeDeli Generator Agent Prompt

역할: spec YAML에 정의된 피처를 코드로 구현하는 전문 에이전트.

입력:
- harness/specs/{피처}.yaml → 구현 목표, 수락 기준, 수정 파일 목록
- CLAUDE.md → 프로젝트 규칙
- feature_list.json → 현재 상태

출력:
- 코드 변경 (지정된 파일만)
- feature_list.json status → "implemented"
- claude-progress.txt 업데이트

금지:
- spec에 명시되지 않은 파일 수정
- status를 "passing"으로 직접 변경 (evaluator 전용)
- src/v2/ 조기 삭제
```

### evaluator_prompt.md 강화 내용 추가
```markdown
# 추가: Generator 출력 검증 방식

Generator가 "implemented" 상태로 설정한 피처를 검증:
1. spec YAML의 acceptance_criteria 각 항목을 체크
2. 카테고리별 테스트 명령 실행
3. 회귀 검사: 이미 passing인 인접 피처에 영향 없는지 확인

상태 전이:
  implemented → passing  (모든 기준 충족)
  implemented → failing  (하나라도 미충족)
  passing → failing      (회귀 감지)
```

### spec YAML 형식 (신규 피처용)
```yaml
# harness/specs/S8T1_loading_fix.yaml
id: S8T1
title: "초기 로딩 최적화 + 로그인 자동 표시"
category: auth
status: pending

implementation_targets:
  - vite.config.ts           # 코드 스플리팅
  - src/components/RequireAuth.tsx  # loading 전략
  - src/layouts/MobileShell.tsx     # 로그인 버튼

acceptance_criteria:
  - 비로그인 상태에서 앱 진입 시 3초 내 로그인 페이지 표시
  - 헤더에 비로그인 시 "로그인" 버튼 표시
  - npm run build 통과 (번들 경고 없음)
  - npx playwright test e2e/mock/auth.spec.ts 전체 통과

test_command: "npx playwright test e2e/mock/ --project=mock"
regression_command: "npm run build && npm run typecheck"
```

---

## P2. preps 스키마 통일

### 현재 상태
- `preps` 테이블: `id, name, updated_at, data jsonb, created_at`
- `prep_items` 테이블: 존재하지만 미사용 (이전 버전 유산)
- `prepsRepo.ts`: `data jsonb` 방식만 사용

### 결정: **data jsonb 방식으로 통일**

이유:
- 현재 코드(`prepsRepo.ts`, `PrepsPage.tsx`)가 이미 jsonb 방식
- `prep_items`는 미사용, 삭제해도 앱에 영향 없음
- 정규화(prep_items) 방식은 재료 연동 기능 확장 시 필요하나 현재 미구현

### 수정 계획
```sql
-- migration 006: prep_items 테이블 제거 + preps 스키마 정리
DROP TABLE IF EXISTS public.prep_items;

-- preps.name 컬럼은 not null 요건 유지 (prepsRepo.ts upsert 시 포함)
-- preps.data jsonb 방식이 단일 진실 소스
```

```typescript
// src/storage/prepsRepo.ts 변경 없음 (이미 data jsonb 방식)
// src/domain/types.ts: PrepIngredientItem 타입 삭제 여부 검토
```

### 검증 명령
```bash
npm run typecheck
npm run test:mock -- e2e/mock/storage.spec.ts
```

---

## P3. src/v2/ 삭제

### 현재 상태
- `src/v2/` 디렉토리 존재 (Sprint 6 이전 버전 코드)
- 현재 `App.tsx`에서 `src/pages/v2/CreateSchedulePage.v2` 등을 import 중

### 수정 계획
```typescript
// App.tsx 현재:
import { CreateSchedulePageV2 as CreateSchedulePage } from './pages/v2/CreateSchedulePage.v2'
import { ManageSchedulesPageV2 as ManageSchedulesPage } from './pages/v2/ManageSchedulesPage.v2'

// 수정: v2 없이 직접 import (단일 버전)
// pages/CreateSchedulePage.tsx, pages/ManageSchedulesPage.tsx 로 이전 or alias 제거
```

순서:
1. v2 페이지들을 `src/pages/` 하위로 이전 (파일 이름 정규화)
2. `App.tsx` import 경로 수정
3. `src/v2/` 디렉토리 삭제
4. tsc + build + mock E2E 확인

### 검증 명령
```bash
npm run typecheck && npm run build
npm run test:mock
```

---

## P4. smoke E2E 실 DB 검증

### 전제 조건
```bash
# .env 파일에 다음 환경변수 필요:
SUPABASE_SERVICE_ROLE_KEY=...
TEST_ADMIN_EMAIL=...
TEST_ADMIN_PASSWORD=...
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
```

### 현재 smoke spec
- `e2e/smoke/` 디렉토리에 S7T1~S7T3 스펙 존재
- 환경변수 없으면 자동 스킵

### 검증 명령
```bash
npx playwright test e2e/smoke/ --project=smoke
```

---

## 하네스 실행 흐름 (재구성 후)

```
사용자 or 자동 트리거
    │
    ▼
[Generator Agent]
spec YAML 읽기 → coding_prompt(generator_prompt) + CLAUDE.md
→ 코드 구현 → status: implemented
→ claude-progress.txt 업데이트
    │
    ▼
[Evaluator Agent]
evaluator_prompt + feature_list.json 읽기
→ typecheck → 카테고리 테스트 → 회귀 검사
→ status: passing or failing
→ feature_list.json 업데이트
→ 리포트 생성 (harness/reports/)
    │
    ▼
모두 passing? → 종료
failing 있음? → Generator 재호출 (max 3 cycles)
```

---

## 신규 feature_list.json 추가 항목 (다음 세션 시작 시)

```json
{
  "id": "S8T1",
  "title": "초기 로딩 최적화 + 로그인 버튼",
  "category": "auth",
  "status": "pending"
},
{
  "id": "S8T2",
  "title": "preps 스키마 통일 (data jsonb 단일화)",
  "category": "db",
  "status": "pending"
},
{
  "id": "S9T1",
  "title": "src/v2/ 디렉토리 삭제",
  "category": "scaffold",
  "status": "pending"
},
{
  "id": "S10T1",
  "title": "smoke E2E 실 DB 전체 검증",
  "category": "smoke",
  "status": "pending"
}
```

---

## 다음 세션 시작 명령 순서

```bash
# 1. 기준선 확인
npm run typecheck && npm run build
npx playwright test e2e/mock/ --project=mock

# 2. feature_list.json에 S8T1~S10T1 추가

# 3. Generator로 S8T1 구현
#    → 로딩 최적화 + 로그인 버튼

# 4. Evaluator로 S8T1 검증
#    → mock E2E auth 통과 확인

# 5. 이후 S8T2 → S9T1 → S10T1 순서로 진행
```

---

## 완료 기준 (전체)

- [ ] S8T1: 비로그인 진입 3초 내 로그인 화면 표시
- [ ] S8T1: 헤더 로그인/로그아웃 버튼 동작
- [ ] S8T2: prep_items 테이블 제거, 스키마 정합
- [ ] S9T1: src/v2/ 완전 제거, tsc + build 통과
- [ ] S10T1: smoke E2E 전체 통과 (실 DB)
- [ ] 하네스: generator/evaluator 분리 완료, spec YAML 4개 생성

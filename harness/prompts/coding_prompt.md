---
noteId: "ff5cf3e02e7111f1979bf9001a062e09"
tags: []

---

# Coding Agent Prompt — LeeDeli

당신은 LeeDeli 프로젝트의 **Coding Agent**입니다.  
**반드시 CLAUDE.md를 먼저 읽은 뒤** 작업을 시작하세요.

## 역할
`feature_list.json`에서 지정된 피처 ID를 구현합니다.

---

## 작업 순서

### Step 1: 컨텍스트 로드
1. `cat CLAUDE.md` — 규칙, 디렉토리 구조, 코딩 규칙 확인
2. `cat feature_list.json` — 전체 피처 목록 및 현재 상태 확인
3. `cat claude-progress.txt` — 현재 진행 상태 확인
4. 구현할 피처의 `description`, `acceptance_criteria` 꼼꼼히 읽기
5. 관련 기존 소스 파일 읽기 (특히 sprint/category 관련 파일)

### Step 2: 의존성 파악
- 이 피처가 이전 피처에 의존하는가? (예: S3T1 AuthContext는 S2T4 useAdmin 필요)
- 의존 피처 status가 "passing"인지 확인
- 아직 안 됐다면: 해당 파일을 직접 stub으로 생성하거나 코딩 agent에게 알림

### Step 3: 코드 구현
- `acceptance_criteria`의 모든 항목을 충족하도록 구현
- CLAUDE.md의 코딩 규칙 준수 (TypeScript strict, React hooks, Supabase repo 패턴)
- **현재 피처 관련 파일만 수정**. 다른 피처 코드 건드리지 않음
- 기존 파일 삭제는 해당 피처에서만 (CLAUDE.md의 주의사항 확인)
- import 경로 변경 시 전체 영향 파악 후 수정

### Step 4: 테스트 파일 작성 (카테고리별)
| category | 테스트 위치 | 실행 명령 |
|---|---|---|
| scaffold | - | npm run build |
| db | - | npm run typecheck |
| auth | e2e/mock/auth.spec.ts | playwright mock |
| storage | e2e/mock/storage.spec.ts | playwright mock |
| engine | tests/unit/ | vitest run |
| ui | e2e/mock/schedule.spec.ts | playwright mock |
| smoke | e2e/smoke/ | playwright smoke |

- Playwright mock 테스트는 `page.route()` 로 Supabase API intercept
- vitest 단위 테스트는 Supabase/DOM 의존 없는 순수 함수만

### Step 5: 로컬 검증
카테고리에 맞는 명령 실행 후 결과 확인:
```bash
# scaffold/db
npm run typecheck && npm run build

# auth/storage/ui  
npx playwright test e2e/mock/ --project=mock

# engine
npx vitest run tests/unit/

# smoke (환경변수 필요)
npx playwright test e2e/smoke/ --project=smoke
```

### Step 6: 상태 업데이트
1. `feature_list.json`의 해당 피처 `status` → `"implemented"`
2. `claude-progress.txt` 업데이트 (CURRENT_FEATURE, PHASE=coding, NOTES)

---

## 주요 금지사항
- `tsc --noEmit` 에러 있는 상태로 "implemented" 변경 금지
- 다른 피처의 passing 상태를 깨는 코드 수정 금지
- `src/v2/` 디렉토리는 S6T2 전까지 삭제 금지
- localStorage repos는 S4T4 전까지 삭제 금지
- Supabase service_role 키를 앱 코드에 노출 금지

---

## 현재 브랜치 확인
```bash
git branch --show-current
# 반드시 'refactor/harness' 브랜치인지 확인
```
main 브랜치에서 작업하지 않도록 주의.

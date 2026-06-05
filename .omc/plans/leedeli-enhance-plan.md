# LeeDeli 웹앱 7가지 고도화 구현 계획 (v3)

**Status:** pending approval
**Spec:** `.omc/specs/deep-interview-leedeli-enhance.md`
**Generated:** 2026-06-05
**Mode:** consensus --direct (RALPLAN-DR short), Iteration 3

---

## Revision History

### v2 → v3 (Critic v2 피드백 반영)
| # | 유형 | 수정 내용 |
|---|------|-----------|
| CRT-1 | Critical | C1에 직전 4개 커밋(02ef398, 823fe39 등) 번복 사유 명시 — 사용자 spec 요구사항 인용 |
| MAJ-1 | Major | C7 칼로리 계산: 비-g 단위(개·장·ml) 재료는 명시적 제외, UI에 "(g 단위 재료만 적용)" 안내 |
| MAJ-2 | Major | C6 보충 이력 라벨 단일 형식 확정: `{r.restock_date}` + memo 있으면 `(memo)` 병기 |
| MAJ-3 | Major | MCP apply_migration = 개발 DB 전용, 파일이 canonical source 명시; 014 untracked 처리 방침 추가 |

### v1 → v2 (Architect + Critic 피드백 반영)
| # | 유형 | 수정 내용 |
|---|------|-----------|
| C1 | Critical | vacation_records.employee_id TEXT → uuid REFERENCES employees(id), RLS auth.jwt → auth.uid() 패턴 |
| C2 | Critical | C6 acceptance "리델리 보충 grep 0건" → 실제 대상(PrepsPage.tsx:921 user_email 라벨) 기준으로 재작성 |
| C3 | Critical | C1 acceptance grep 패턴 → `role.*\?\s*'blue'` 정규식으로 좁힘, line 438/447 오탐 제거 |
| C4 | Critical | PR 단위 표 추가, Principle 5/ADR 일관화 (컴포넌트 축 vs Phase 축 분리) |
| M5 | Major | yieldAmount vs targetQuantity 의미 차이 ADR 명시 (두 필드 공존 정책) |
| M6 | Major | 칼로리 계산 단위 전제 명시(g 가정), 0나눗셈 가드, useMemo 키 정책 추가 |
| M7 | Major | Verification Steps 2/3 grep 패턴 수정 (C1/C6와 동기화) |
| M8 | Major | C3 acceptance에 e2e mock 테스트 파일 명세 추가 |
| M9 | Major | generate_typescript_types → database.types.ts 별도 파일, types.ts 수동 유지 정책 추가 |
| + | 추가 | 롤백 전략 섹션 추가 |
| + | 추가 | C2 정렬에서 휴가자 표시 정책 명시 |
| + | 추가 | C6 일괄 보충 추가 트랜잭션 정책 명시 |

---

## RALPLAN-DR Summary (v2)

### Principles
1. **타입 단일 소스** — `src/domain/types.ts`만 수정, MCP generate_typescript_types 결과는 `src/domain/database.types.ts`로 분리
2. **MCP 우선 DB 변경** — 스키마 변경은 `apply_migration` MCP로 즉시 적용, 로컬 파일 동기화는 후속
3. **런타임 파생값** — 칼로리는 저장하지 않고 렌더 시 useMemo로 계산 (g 단위 전제)
4. **최소 침습** — 기존 JSX 구조 유지, 새 로직은 유틸 함수·훅으로 분리
5. **PR 단위 독립 배포** — C1/C2/C3은 DB 무관 단독 PR, C4/C6/C7은 마이그레이션 포함 PR

### Decision Drivers
1. ShiftType 동적 추가에도 색상 자동 배정 (role 기반 삼항 패턴 완전 제거)
2. DB 스키마 drift 방지 (MCP apply → 파일 동기화, types.ts는 수동 진실 소스 유지)
3. 보충 캘린더 UI는 기존 컴포넌트 재사용 (재작성 금지)

### Options
| Option | Approach | Pro | Con | Decision |
|--------|----------|-----|-----|----------|
| A: Phase 순차 + PR 컴포넌트 축 | Phase는 의존성 순서, PR은 컴포넌트 독립 단위 | 의존성 안전 + 독립 배포 양립 | PR 4개 관리 오버헤드 | ✅ 채택 |
| B: 타입 레이어 전체 선완 후 UI 일괄 | types+DB 전체 먼저 | 타입 오류 조기 발견 | 중간 검증 불가, Phase 0~7 일괄 머지 강제 | ❌ 기각 |
| C: 7개 컴포넌트 완전 독립 vertical slice | 각 C가 DB+types+repo+UI 모두 포함 | 진짜 독립 | PR 7개 타입 파일 충돌, 리뷰 불가 | ❌ 기각 |

**Option B 기각 근거 (수정):** 타입 전체 선완은 중간 UI 검증 불가 문제가 있으나, Option A의 Phase 0~1도 DB+타입 변경 후 UI 미완성 구간이 발생한다는 점에서 동일 위험을 공유한다. Option A가 Option B보다 나은 이유는 PR 단위를 컴포넌트 축으로 쪼개면 DB 무관 C1/C2/C3을 즉시 배포하고 나머지를 순차로 머지할 수 있기 때문이다.

**Option C 기각 근거:** 7개 PR이 모두 `types.ts`를 동시 수정하면 머지 충돌이 불가피. 타입 변경을 PR별로 분리하는 비용이 이득을 초과한다.

### PR 단위 배포 계획
| PR | 포함 컴포넌트 | DB 의존 | 사전 조건 |
|----|--------------|---------|----------|
| PR1 | C1(색상), C2(정렬), C3(메모 모아보기) | 없음 | 없음 |
| PR2 | C5(총량), C7(칼로리) | 타입 변경만 | PR1 머지 권장 |
| PR3 | C6(보충 메모 & 이력) | restock_history.memo | 마이그레이션 016 선행 |
| PR4 | C4(휴가 관리) | vacation_records 신규 | 마이그레이션 015 선행 |

---

## Requirements Summary

LeeDeli 카페 운영 웹앱에서 다음 7가지 기능을 고도화한다.

| # | 기능 | 변경 대상 파일 |
|---|------|---------------|
| C1 | 색상 채도 구분 | `src/utils/shiftColors.ts` (신규), `src/pages/CreateSchedulePage.tsx` |
| C2 | 근무 시간별 정렬 | `src/pages/CreateSchedulePage.tsx` |
| C3 | 메모 모아보기 | `src/pages/CreateSchedulePage.tsx`, `e2e/mock/schedule-memo.spec.ts` (신규) |
| C4 | 휴가 사용 관리 | `src/domain/types.ts`, `src/storage/vacationRepo.ts` (신규), `supabase/migrations/015_vacation_records.sql` |
| C5 | 프렙 총량 관리 | `src/domain/types.ts`, `src/pages/PrepsPage.tsx` |
| C6 | 보충 메모 & 이력 | `src/domain/types.ts`, `src/storage/restockRepo.ts`, `src/pages/PrepsPage.tsx`, `supabase/migrations/016_restock_memo.sql` |
| C7 | 칼로리 연동 계산 | `src/domain/types.ts`, `src/utils/calorieCalc.ts` (신규), `src/pages/IngredientsPage.tsx`, `src/pages/PrepsPage.tsx`, `src/pages/MenuPage.tsx` |

---

## Acceptance Criteria

### C1: 색상 채도 구분

> **직전 커밋 번복 사유 (필독):** 커밋 `02ef398`("근무유형 색 구분 제거 → 직역 기반 파랑/주황 태그"), `823fe39`(마카롱 팔레트 교체), `ade8ce9`(RGBA 변환 함수 추가), `c2d6ff2`(텍스트 색상 계산)는 ShiftType별 다채색에서 역할 기반 단일색으로 단순화했다. 본 C1은 이 결정을 번복한다. 번복 근거: 사용자가 deep-interview spec(`.omc/specs/deep-interview-leedeli-enhance.md` C1)에서 "정직원은 모두 파란색 계열인데 오픈/미들/마감에 따라 채도/명도를 조금씩 바꿈"을 명시적으로 요구했다. HSL 채도 분배는 역할 색상 계열(파랑/주황)을 **유지**하면서 그 안에서 미세하게 변화시키는 방식으로 마카롱 팔레트 전면 교체가 아닌 role 기반 접근의 **확장**이다. `c2d6ff2`의 텍스트 색상 자동 계산 함수(`getTextColor`)는 HSL 배경색에도 동일하게 적용 가능하므로 보존한다.

- [ ] `src/utils/shiftColors.ts` 신규 파일에 `getShiftColor(role, shiftIndex, totalShifts): string` 함수 존재
- [ ] 정직원 태그: HSL hue 210±10, 채도 40~80% 균등 분배 (totalShifts 기준)
- [ ] 알바 태그: HSL hue 30±5, 채도 40~80% 균등 분배
- [ ] `grep -E "role[^?]*\?\s*'blue'\s*:\s*'orange'" src/pages/CreateSchedulePage.tsx` → 0건 (line 438/447 주차 탭 'blue'는 대상 외)
- [ ] ShiftType 1개/3개/5개 시나리오에서 각 태그 색상 중복 없음

### C2: 근무 시간별 정렬
- [ ] 스케줄 일별 배정 목록에서 role='정직원' 항목이 '알바' 항목보다 항상 위에 위치
- [ ] 정직원 그룹 내: ShiftType.startTime 오름차순 (HH:MM 문자열 비교)
- [ ] 알바 그룹 내: ShiftType.startTime 오름차순
- [ ] 휴가 상태(C4 도입 후)인 직원은 정렬 목록 최하단 또는 별도 구분선 표시 (C4 미완료 시 미적용)

### C3: 메모 모아보기
- [ ] 스케줄 선택 시 "메모 보기" 버튼 활성화 (미선택 시 disabled)
- [ ] 클릭 시 Ant Design `<Drawer>` 또는 `<Modal>`에 현재 스케줄의 note 있는 항목만 렌더링
- [ ] 표시 항목: 날짜, 직원명, 근무유형명, 메모 내용
- [ ] note 없는 항목은 목록 미포함
- [ ] 빈 메모 목록 시 "등록된 메모가 없습니다" 안내 표시
- [ ] `e2e/mock/schedule-memo.spec.ts` 신규 파일에 (a) 메모 0건 → 안내 표시, (b) 메모 N건 → N행 렌더링 테스트 추가

### C4: 휴가 사용 관리
- [ ] `supabase/migrations/015_vacation_records.sql` 파일 존재, SQL 아래 스키마 포함:
  - `employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE`
  - RLS policy: `auth.uid()` + `admin_users.user_id` 패턴 사용
- [ ] Supabase MCP `apply_migration`으로 vacation_records 테이블 실제 생성 확인 (`list_tables` 검증)
- [ ] `src/storage/vacationRepo.ts` 신규: `getVacations(employeeId)`, `addVacation(record)`, `deleteVacation(id)` 함수
- [ ] `VacationRecord` 타입이 `src/domain/types.ts`에 정의됨 (`employee_id: string` — UUID 포맷임을 주석 명시)
- [ ] 휴가 추가 UI: 날짜·유형(연차/반차(오전)/반차(오후)/공가/기타)·비고 입력 가능 ('기타' 선택 시 자유 텍스트 note 입력)
- [ ] 직원별 휴가 이력 목록 조회 가능

### C5: 프렙 총량 관리
- [ ] `Prep` 타입에 `targetQuantity?: number`, `targetUnit?: string` 필드 추가 (`src/domain/types.ts`)
  - `yieldAmount`: 1회 배치 실제 산출량 (기존 유지, 단가 계산 기준)
  - `targetQuantity`: 일/주 단위 보관 목표 총량 (신규, 다른 의미)
- [ ] `PrepsPage.tsx`에서 각 프렙 카드에 "목표 총량" 표시 (`targetQuantity targetUnit`)
- [ ] `<InputNumber>` + `<Select>` 조합으로 목표 총량 인라인 편집 후 저장 가능
- [ ] 기존 `yieldAmount` 기반 단가 계산 로직(`PrepsPage.tsx:642`)은 변경 없음

### C6: 보충 메모 & 이력
- [ ] `supabase/migrations/016_restock_memo.sql`: `ALTER TABLE restock_history ADD COLUMN IF NOT EXISTS memo TEXT;` 포함
- [ ] Supabase MCP `apply_migration`으로 실제 컬럼 추가 확인 (`execute_sql SELECT column_name FROM information_schema.columns WHERE table_name='restock_history'`)
- [ ] `RestockRecord` 타입에 `memo?: string` 추가 (`src/domain/types.ts`)
- [ ] `restockRepo.ts`의 보충 추가 함수에 `memo?: string` 파라미터 추가
- [ ] 프렙 수정 모달: 첫 번째 탭이 "보충 이력" (기존 탭 순서 변경)
- [ ] 보충 이력 탭: 날짜별 memo 표시, memo 없는 경우 날짜만 표시
- [ ] 보충 추가 폼에 memo 입력란 추가
- [ ] `PrepsPage.tsx:921` 의 `{r.user_email} 보충` 라벨을 **`{r.restock_date}{r.memo ? ` (${r.memo})` : ''}`** 형식으로 교체 (단일 형식 확정: 날짜 + 메모 있으면 괄호 병기, grep 확인: `user_email.*보충` 0건)
- [ ] 보충 이력 캘린더에서 각 이벤트에 프렙명과 비용만 표시 (user_email 미표시)
- [ ] 캘린더 날짜 셀 클릭 → 프렙 체크박스 다중 선택 모달 → "보충 추가" 실행
- [ ] 일괄 보충 추가는 `Promise.allSettled` 또는 `supabase.from().insert([...])` 배열 삽입으로 원자적 처리; 부분 실패 시 실패 항목 목록 사용자에게 표시

### C7: 칼로리 연동 계산
- [ ] `Ingredient` 타입에 `caloriesPer100g?: number` 추가 (`src/domain/types.ts`)
- [ ] `src/utils/calorieCalc.ts` 신규:
  - `calcPrepCalories(prep, ingredients)`: **g 단위 재료만** 계산 — `unitType === 'g'`인 재료 우선, `unitType` 미지정 레거시 데이터는 `unitLabel === 'g'` fallback. 비-g(개·장·ml 등)는 **재료 개별 0 처리** (prep 전체를 '-'로 만들지 않음 — g 재료들의 합산은 유지)
  - `calcMenuCalories(menu, preps, ingredients)`: Prep 칼로리 × prepAmount(인분 배수) + g 재료 직접 포함
  - 0나눗셈/undefined 방어: `(caloriesPer100g ?? 0) * (amount ?? 0) / 100`
  - **범위 제한**: 비-g 재료 칼로리 지원은 이번 범위 외 (별도 sprint에서 `gramsPerUnit` 환산 필드 추가 검토)
- [ ] IngredientsPage 칼로리 입력 필드 옆에 "(g 단위 재료만 적용)" 안내 텍스트 표시
- [ ] `IngredientsPage.tsx` 재료 수정 UI에 "칼로리 (kcal/100g)" `<InputNumber>` 필드 추가
- [ ] `PrepsPage.tsx`에서 `useMemo([prep.items, ingredients], calcPrepCalories)` 결과 표시
- [ ] `MenuPage.tsx`에서 `useMemo([menu.ingredientItems, menu.prepItems, preps, ingredients], calcMenuCalories)` 결과 표시
- [ ] 재료 칼로리 변경 → 해당 재료 포함 Prep 표시값 자동 갱신 (같은 페이지 내 재마운트 불필요 → useMemo 의존성으로 해결)

---

## Implementation Steps

### Phase 0: DB 스키마 변경 (Supabase MCP 선행)

**MCP apply_migration 정책:**
- `apply_migration`은 **개발 DB 전용** (즉시 원격 적용). 운영/스테이징 배포는 파일 기반 (`supabase db push` 또는 대시보드 마이그레이션)으로 별도 수행
- 파일(`supabase/migrations/*.sql`)이 canonical source — MCP 적용 후 반드시 파일 커밋
- **014 untracked 처리**: `supabase/migrations/014_security_fix_rls.sql`이 현재 git untracked 상태. PR3(C6)과 PR4(C4) 중 **먼저 시작되는 쪽이 014를 동일 PR에 포함**하여 커밋. 이후 PR은 014 없이 015 또는 016만 추가
- `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` 패턴 필수 — idempotency 보장

**사전 확인:**
```
mcp__claude_ai_Supabase__list_tables  → 현재 테이블 목록 확인
mcp__claude_ai_Supabase__execute_sql  → SELECT column_name FROM information_schema.columns WHERE table_name='restock_history'
```

**Step 0-A: restock_history.memo 컬럼 추가**
```sql
-- supabase/migrations/016_restock_memo.sql
ALTER TABLE restock_history ADD COLUMN IF NOT EXISTS memo TEXT;
```
- MCP `apply_migration` 실행 후 `execute_sql` 검증

**Step 0-B: vacation_records 신규 테이블 (C4 PR 직전에 실행)**
```sql
-- supabase/migrations/015_vacation_records.sql
CREATE TABLE IF NOT EXISTS public.vacation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('연차','반차(오전)','반차(오후)','공가','기타')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vacation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY vacation_records_rw ON public.vacation_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.revoked_at IS NULL
    )
  );
```
- MCP `apply_migration` 실행, `list_tables`로 vacation_records 확인

**롤백 전략:**
- 0-A 실패: `ALTER TABLE restock_history DROP COLUMN IF EXISTS memo;`
- 0-B 실패: `DROP TABLE IF EXISTS public.vacation_records;`
- 두 경우 모두 기존 데이터·기능에 영향 없음 (NULLable 신규 컬럼/신규 테이블)

### Phase 1: 타입 레이어 업데이트 (`src/domain/types.ts`)

순서대로 추가 (기존 타입 필드 삭제/변경 금지):
1. `Ingredient` → `caloriesPer100g?: number` (C7)
2. `Prep` → `targetQuantity?: number`, `targetUnit?: string` (C5, yieldAmount와 별개 의미)
3. `RestockRecord` → `memo?: string` (C6)
4. 신규 `VacationRecord` 타입 추가 (C4):
   ```typescript
   // employee_id는 UUID 포맷 (public.employees.id 참조)
   export type VacationRecord = {
     id: string
     employee_id: string
     date: string   // YYYY-MM-DD
     type: '연차' | '반차(오전)' | '반차(오후)' | '공가' | '기타'
     note?: string
     created_at: string
   }
   ```

**중요:** MCP `generate_typescript_types` 결과는 `src/domain/database.types.ts`(신규)로 저장. `types.ts`는 이를 참조하거나 독립 유지 — DB 타입과 도메인 타입 drift 비교 용도로만 활용. `types.ts` 자동 덮어쓰기 금지.

완료 후 `npm run build` tsc 오류 0건 확인.

### Phase 2: 유틸리티 함수 신규 작성

**Step 2-A: `src/utils/shiftColors.ts` (C1)**
```typescript
/**
 * role별 HSL 기반 ShiftType 색상 동적 배정
 * 정직원: hue 210, 알바: hue 30
 * totalShifts=1이면 채도 60(중간), n>1이면 40~80 균등 분배
 */
export function getShiftColor(
  role: '정직원' | '알바',
  shiftIndex: number,
  totalShifts: number
): string {
  const hue = role === '정직원' ? 210 : 30
  const minS = 40, maxS = 80
  const saturation = totalShifts <= 1
    ? 60
    : Math.round(minS + (maxS - minS) * (shiftIndex / (totalShifts - 1)))
  const lightness = 45  // 고정 (가독성)
  return hslToHex(hue, saturation, lightness)
}

function hslToHex(h: number, s: number, l: number): string { /* 표준 HSL→HEX */ }
```

**Step 2-B: `src/utils/calorieCalc.ts` (C7)**
```typescript
// 전제: amount는 g 단위. caloriesPer100g 미입력 재료는 0 처리
export function calcPrepCalories(prep: Prep, ingredients: Ingredient[]): number
export function calcMenuCalories(menu: MenuItem, preps: Prep[], ingredients: Ingredient[]): number
```

### Phase 3: Storage 레이어

**Step 3-A: `src/storage/restockRepo.ts` 수정 (C6)**
- `addRestockRecord(prepId, date, memo?: string)` — memo 파라미터 추가
- 조회 함수에 `memo` 컬럼 포함

**Step 3-B: `src/storage/vacationRepo.ts` 신규 (C4)**
```typescript
export async function getVacations(employeeId: string): Promise<VacationRecord[]>
export async function addVacation(record: Omit<VacationRecord, 'id' | 'created_at'>): Promise<void>
export async function deleteVacation(id: string): Promise<void>
```
- 모든 쿼리는 `supabase` 싱글턴(`src/utils/supabase.ts`) 사용
- error 패턴: `const { data, error } = await supabase.from('vacation_records')...` → error 필수 체크

### Phase 4: CreateSchedulePage.tsx 변경 (C1, C2, C3)

**Step 4-A: 색상 로직 교체 (C1)**
- 대상: `src/pages/CreateSchedulePage.tsx` line ~809, ~1109, ~1257
- `role === '정직원' ? 'blue' : 'orange'` 삼항 패턴 → `getShiftColor(emp.role, shiftIdx, totalShifts)` 교체
- `shiftIdx = shiftTypes.findIndex(s => s.id === entry.shiftTypeId)`
- line 438, 447의 주차 탭 `'blue'`/`'geekblue'`는 변경 대상 외

**Step 4-B: 정렬 로직 (C2)**
```typescript
const sortedEntries = [...dayEntries].sort((a, b) => {
  const roleA = employees.find(e => e.id === a.employeeId)?.role ?? '알바'
  const roleB = employees.find(e => e.id === b.employeeId)?.role ?? '알바'
  if (roleA !== roleB) return roleA === '정직원' ? -1 : 1
  const startA = shiftTypes.find(s => s.id === a.shiftTypeId)?.startTime ?? ''
  const startB = shiftTypes.find(s => s.id === b.shiftTypeId)?.startTime ?? ''
  return startA.localeCompare(startB)  // HH:MM 문자열 비교
})
```

**Step 4-C: 메모 모아보기 (C3)**
- "메모 보기" 버튼: 스케줄 미선택 시 `disabled`, 선택 시 활성
- `<Drawer placement="right">` 내 현재 schedule.entries를 순회하여 note 있는 항목 `<List>` 렌더링
- 빈 목록: `<Empty description="등록된 메모가 없습니다" />`
- `e2e/mock/schedule-memo.spec.ts` 작성 (mock schedule with/without notes)

### Phase 5: PrepsPage.tsx 변경 (C5, C6)

**Step 5-A: 목표 총량 UI (C5)**
- 프렙 카드에 "목표 총량" 섹션 추가 (`targetQuantity targetUnit`)
- `<InputNumber>` + `<Select unit>` 인라인 편집, blur 시 `prepsRepo.updatePrep(id, { targetQuantity, targetUnit })`
- `yieldAmount` 기반 단가 계산(`line 642`) 변경 없음

**Step 5-B: 수정 모달 탭 개선 (C6)**
- 기존 탭 순서 확인 후 "보충 이력" 탭을 첫 번째로 이동
- 보충 이력 탭: `<Timeline>` 또는 `<Table>` — 날짜별 memo 표시 (memo 없으면 '-')
- 보충 추가 폼: memo `<Input.TextArea>` 추가
- `line 921`의 `{r.user_email} 보충` → `{r.restock_date}` (또는 memo 우선 표시)로 교체

**Step 5-C: 캘린더 UI 개선 (C6)**
- 캘린더 이벤트 셀: 프렙명 + 비용만 표시 (user_email 제거)
- 날짜 셀 클릭 핸들러: `<Modal>`로 프렙 체크박스 다중 선택
- "보충 추가" 버튼 클릭 → `supabase.from('restock_history').insert([...records])` 배열 삽입
- `Promise.allSettled` 또는 배열 insert 후 오류 항목 있으면 `<Alert>` 표시

### Phase 6: IngredientsPage + MenuPage 칼로리 (C7)

**Step 6-A: IngredientsPage.tsx**
- 재료 수정 모달에 `<InputNumber min={0} placeholder="kcal/100g">` 추가
- 저장 시 `caloriesPer100g` 포함 `ingredientsRepo.updateIngredient` 호출

**Step 6-B: PrepsPage.tsx 칼로리**
- `const prepCalories = useMemo(() => calcPrepCalories(prep, ingredients), [prep.items, ingredients])`
- 카드/상세에 `{prepCalories > 0 ? `${prepCalories} kcal` : '-'}` 표시

**Step 6-C: MenuPage.tsx 칼로리**
- `const menuCalories = useMemo(() => calcMenuCalories(menu, preps, ingredients), [menu.ingredientItems, menu.prepItems, preps, ingredients])`
- 카드/상세에 동일 패턴 표시

### Phase 7: 타입 동기화 및 빌드 검증

1. `mcp__claude_ai_Supabase__generate_typescript_types` → `src/domain/database.types.ts` (신규, types.ts 덮어쓰기 금지)
2. `npm run build` — tsc 오류 0건
3. `npm run lint` — 신규 파일 경고 0건

---

## Risks and Mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| vacation_records FK 참조 오류 (employees.id 형식 불일치) | Low | High | Phase 0 사전 `list_tables`로 employees.id 타입 확인, UUID REFERENCES 명시 |
| generate_typescript_types가 types.ts 덮어쓰기 | Low | High | 별도 database.types.ts 파일로 결과 분리, 자동화 명시 |
| CreateSchedulePage 1447줄 회귀 | Medium | High | 색상/정렬/메모 각각 별도 함수 분리, 기존 JSX 최소 수정, e2e visual baseline 재생성 |
| restock_history 배열 삽입 부분 실패 | Low | Medium | Promise.allSettled 후 실패 항목 Alert 표시 |
| yieldAmount/targetQuantity 의미 혼동 | Low | Medium | UI 라벨 명확 분리("1회 산출량" vs "목표 보관량"), 코드 주석 |
| 칼로리 단위 불일치 (g 아닌 재료) | Medium | Low | calcPrepCalories 내 `amount`가 g 아니면 0으로 처리, UI에 "(g 기준)" 안내 |
| 보충 이력 캘린더 시각적 회귀 | Low | Low | 기존 캘린더 컴포넌트 재사용, user_email → date 교체만 |

---

## Verification Steps

1. `npm run build` → tsc 오류 0건
2. `grep -Ec "role[^?]*\?\s*'blue'\s*:\s*'orange'" src/pages/CreateSchedulePage.tsx` → 0 (C1)
3. `grep -n "user_email.*보충\|보충.*user_email" src/pages/PrepsPage.tsx` → 0건 (C6)
4. Supabase MCP `execute_sql`: `SELECT column_name FROM information_schema.columns WHERE table_name='restock_history' AND column_name='memo'` → 1행 반환 (C6)
5. Supabase MCP `list_tables` → `vacation_records` 존재 확인 (C4)
6. 브라우저 확인: ShiftType 3개 상태로 스케줄 열기 → 정직원 태그 3가지 파랑 음영, 알바 태그 3가지 주황 음영 (C1)
7. 브라우저 확인: 재료 칼로리 입력 → 해당 재료 포함 Prep 칼로리 표시 자동 변경 (C7)
8. `npx playwright test e2e/mock/schedule-memo.spec.ts --project=mock` → 통과 (C3)

---

## ADR (Architecture Decision Record v2)

**Decision:** Phase 0→7 의존성 순서 유지 + PR은 컴포넌트 축으로 4개 단위 분할

**Drivers:**
- DB 스키마 drift 방지 (MCP apply → 파일 동기화)
- C1/C2/C3은 DB 무관 → 즉시 배포 가능
- C4/C6는 마이그레이션 선행 필요 → 별도 PR

**Alternatives Considered:**
- 7개 완전 vertical slice: types.ts 충돌로 기각
- 타입 전체 선완(Option B): 중간 UI 검증 불가로 기각
- Phase 순차 단일 PR: 리뷰 불가, 롤백 단위 너무 큼으로 기각

**Why Chosen:**
PR1(C1/C2/C3)은 즉시 머지 가능, PR2(C5/C7)는 types.ts 변경만 의존, PR3/PR4는 각각 마이그레이션 포함하여 독립 배포 가능. Phase 의존성(Phase 0→1→2→...)은 각 PR 내부 순서이며 PR 간 의존성은 최소화.

**Consequences:**
- 각 PR 완료 후 `npm run build` 독립 통과 가능
- PR1은 스키마 변경 없어 즉시 배포 안전
- PR3/PR4는 마이그레이션 + 앱 코드 동시 배포 필요

**Follow-ups:**
- C4(휴가) 완료 후 ScheduleEntry에 휴가 연계 표시 여부 별도 결정
- 칼로리 단위(g 이외) 지원 여부 별도 결정
- `database.types.ts`와 `types.ts` drift 자동 감지 CI 스크립트 검토

---

## Changelog

### v2 (2026-06-05) — Architect + Critic 피드백 반영
- vacation_records SQL: employee_id uuid + ON DELETE CASCADE + auth.uid() RLS 패턴
- C6 acceptance criterion: 실제 대상(PrepsPage.tsx:921) 기준으로 재작성
- C1 grep: 정규식 `role[^?]*\?\s*'blue'\s*:\s*'orange'`으로 좁힘
- PR 단위 표 추가, Principle 5/ADR 일관화
- yieldAmount vs targetQuantity 의미 차이 ADR 명시
- 칼로리 계산 g 단위 전제, 0나눗셈 가드, useMemo 키 명시
- generate_typescript_types → database.types.ts 분리 정책
- 롤백 SQL 추가
- C3 e2e mock 테스트 파일 명세 추가
- C6 일괄 보충 트랜잭션 정책 (Promise.allSettled) 추가

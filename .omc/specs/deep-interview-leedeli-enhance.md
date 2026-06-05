# Deep Interview Spec: LeeDeli 웹앱 7가지 고도화

## Metadata
- Interview ID: leedeli-enhance-2026-06-05
- Rounds: 2 (Round 0 topology + user clarification round)
- Final Ambiguity Score: 13.6%
- Type: brownfield
- Generated: 2026-06-05
- Threshold: 0.2 (20%)
- Threshold Source: default
- Initial Context Summarized: no
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.91 | 0.35 | 0.3185 |
| Constraint Clarity | 0.87 | 0.25 | 0.2175 |
| Success Criteria | 0.82 | 0.25 | 0.2050 |
| Context Clarity | 0.88 | 0.15 | 0.1320 |
| **Total Clarity** | | | **0.8730** |
| **Ambiguity** | | | **13.6%** |

## Topology
| Component | Status | Description | Coverage Note |
|-----------|--------|-------------|--------------|
| 색상 채도 구분 | active | Role 색상 계열 유지하면서 ShiftType별 채도/명도 동적 미세 변화 | 수용기준 포함 |
| 근무 시간별 정렬 | active | 정직원 우선, 같은 role 내 근무 시작 시간 순 정렬 | 수용기준 포함 |
| 메모 모아보기 | active | 스케줄 전체 note를 모아 보는 뷰 | 수용기준 포함 |
| 휴가 사용 관리 | active | 직원별 휴가 신청·사용 이력 저장 및 관리 (신규) | 수용기준 포함 |
| 프렙 총량 관리 | active | 총 비용 대신 총량 표시, 사용자 목표 총량 기록 | 수용기준 포함 |
| 보충 메모 & 이력 | active | 보충 시 메모, 이력 조회, 캘린더 UI 개선, 다중선택 추가 | 수용기준 포함 |
| 칼로리 연동 계산 | active | 재료→프렙→메뉴 칼로리 연동 자동 계산 | 수용기준 포함 |

---

## Goal
LeeDeli 카페 운영 웹앱의 7가지 기능을 고도화한다:
1. 스케줄 뷰에서 직원 role 색상 계열(정직원=파랑, 알바=주황)을 유지하면서, ShiftType(근무유형)별로 채도/명도를 동적으로 다르게 배정하여 같은 직원의 다른 근무유형을 시각적으로 구분한다.
2. 스케줄 배정 목록을 정직원 먼저, 알바 나중 순으로 정렬하되, 같은 role 내에서는 근무 시작 시간(startTime) 오름차순으로 정렬한다.
3. 특정 스케줄 내 모든 메모(ScheduleEntry.note)를 한 화면에서 모아볼 수 있는 뷰를 제공한다.
4. 직원별 휴가 신청·사용 이력을 저장하고 관리할 수 있는 신규 기능을 구현한다.
5. 프렙 관리에서 총 비용 대신 총량(수량)을 표시하고, 사용자가 목표 총량 값을 직접 기록·편집할 수 있게 한다.
6. 보충 이력 기능을 확장: 보충 시 메모 입력, 날짜별 메모 조회, 프렙/메뉴 수정창에서 보충이력 우선 표시, 캘린더 UI에서 "리델리 보충" 텍스트 제거, 캘린더 날짜 선택 후 다중 메뉴/프렙 선택으로 보충 이력 일괄 추가.
7. 재료(Ingredient)에 칼로리 필드를 추가하고, 프렙 조합 시 재료 기반 칼로리를 자동 계산, 메뉴 조합 시 프렙/재료 기반 최종 칼로리를 산출한다.

---

## Constraints

### Component 1: 색상 채도 구분
- 정직원은 파랑 계열(hsl(210, x%, y%)), 알바는 주황 계열(hsl(30, x%, y%)) 유지 필수
- 오픈/미들/마감으로 고정하지 말고, ShiftType 목록의 인덱스 기반으로 동적으로 채도/명도 배정
- ShiftType이 1개일 때도, 10개일 때도 균등하게 분배되어야 함
- Ant Design 태그 컴포넌트가 hex color를 지원하므로 HSL→HEX 변환 필요
- 기존 `role === '정직원' ? 'blue' : 'orange'` 로직을 교체

### Component 2: 근무 시간별 정렬
- 정렬 우선순위 1순위: role (정직원 < 알바)
- 정렬 우선순위 2순위: ShiftType.startTime 오름차순 (HH:MM 문자열 비교)
- CreateSchedulePage.tsx의 일별 배정 렌더링 부분에 적용

### Component 3: 메모 모아보기
- 현재 선택된 스케줄(ScheduleV3) 기준으로 모든 entries를 순회하여 note가 있는 것만 모음
- 표시 정보: 날짜, 직원명, 근무유형명, 메모 내용
- 별도 모달 또는 탭/패널로 접근 가능해야 함

### Component 4: 휴가 사용 관리
- 신규 Supabase 테이블: `vacation_records` (employee_id, date, type, note, created_at)
- vacation type: '연차' | '반차(오전)' | '반차(오후)' | '공가' | '기타'
- 직원별 잔여 휴가 일수 저장 및 사용 차감 로직 필요
- UI: 스케줄 페이지 내 또는 별도 휴가 관리 탭

### Component 5: 프렙 총량 관리
- Prep 타입에 `targetQuantity?: number`, `targetUnit?: string` 필드 추가 (기존 yieldAmount와 구분)
- PrepsPage에서 현재 "총 비용" 표시를 "총량" 표시로 교체 (또는 병렬 표시)
- 사용자가 직접 총량 목표값을 인라인 편집 가능

### Component 6: 보충 메모 & 이력
- RestockRecord 타입에 `memo?: string` 필드 추가
- restockRepo의 Supabase 테이블 `restock_history`에 `memo` 컬럼 추가 마이그레이션 필요
- 프렙/메뉴 수정 모달 열릴 때 보충 이력 탭이 기본(첫 번째) 탭으로 표시
- 보충 이력 캘린더: "리델리 보충" 텍스트 제거, 프렙 이름과 비용만 표시
- 캘린더에서 날짜 셀 클릭 → 프렙/메뉴 다중 선택 → 일괄 보충 이력 추가 UI 구현

### Component 7: 칼로리 연동 계산
- Ingredient 타입에 `caloriesPer100g?: number` 필드 추가
- Prep 타입에 `calculatedCalories?: number` (자동 계산, 저장하지 않고 런타임 계산)
- MenuItem 타입에 `calculatedCalories?: number` (자동 계산)
- 계산 공식:
  - Prep 칼로리 = Σ(재료별 caloriesPer100g × 사용량 / 100)
  - MenuItem 칼로리 = Σ(Prep 칼로리 × 사용량) + Σ(재료 칼로리 × 사용량 / 100)
- 재료 수정 UI, 프렙 수정 UI, 메뉴 수정 UI에 칼로리 필드 추가

---

## Non-Goals
- 영양 성분 전체 항목 (탄수화물, 단백질, 지방 등) — 이번엔 칼로리만
- 휴가 승인 워크플로우 (신청 → 승인 → 반려) — 단순 기록/관리만
- 색상 테마 전체 커스터마이즈 — role별 기본 hue 고정
- 모바일 최적화 전용 UI — 기존 반응형 패턴 유지
- 보충 이력 삭제 기능 — 이번 범위 외

---

## Acceptance Criteria

### C1: 색상 채도 구분
- [ ] 정직원 직원의 태그가 모두 파랑 hue(200~220) 계열이고, ShiftType 개수에 따라 채도/명도가 균등 분배됨
- [ ] 알바 직원의 태그가 모두 주황 hue(25~35) 계열이고, ShiftType 개수에 따라 균등 분배됨
- [ ] ShiftType을 1개, 3개, 5개로 변경했을 때 각각 적절히 분배된 색상이 적용됨
- [ ] 기존 `'blue'`/`'orange'` 하드코딩 로직이 제거됨

### C2: 근무 시간별 정렬
- [ ] 스케줄 일별 배정 목록에서 정직원이 알바보다 항상 먼저 나타남
- [ ] 같은 정직원 그룹 내에서 시작 시간 빠른 순으로 정렬됨
- [ ] 같은 알바 그룹 내에서 시작 시간 빠른 순으로 정렬됨

### C3: 메모 모아보기
- [ ] 스케줄 뷰에서 "메모 보기" 버튼/탭 클릭 시 해당 스케줄의 모든 note가 있는 항목이 나열됨
- [ ] 날짜, 직원명, 근무유형, 메모 내용이 표시됨
- [ ] note가 없는 항목은 목록에 포함되지 않음

### C4: 휴가 사용 관리
- [ ] `vacation_records` 테이블이 Supabase에 생성되고 마이그레이션 파일이 존재함
- [ ] 직원별 휴가 추가(신청) UI에서 날짜, 유형, 메모 입력 후 저장 가능
- [ ] 직원별 휴가 이력 목록 조회 가능
- [ ] 잔여 휴가 일수(연차 기준) 표시 가능

### C5: 프렙 총량 관리
- [ ] PrepsPage에서 각 프렙 항목에 총량 목표값이 표시됨
- [ ] 총량 목표값 편집 버튼/인라인 편집으로 값 수정 후 저장됨
- [ ] Prep 타입에 `targetQuantity`, `targetUnit` 필드가 추가됨

### C6: 보충 메모 & 이력
- [ ] `restock_history` 테이블에 `memo` 컬럼이 추가된 마이그레이션 파일 존재
- [ ] 보충 추가 시 메모 입력란이 제공되고 저장됨
- [ ] 프렙 수정 모달에서 첫 번째 탭이 보충 이력이고, 날짜별 메모가 표시됨
- [ ] 보충 이력 캘린더 셀에 "리델리 보충" 텍스트가 제거되고 프렙 이름과 비용만 표시됨
- [ ] 캘린더 날짜 셀 클릭 → 프렙/메뉴 다중 선택 → 일괄 보충 이력 추가 가능

### C7: 칼로리 연동 계산
- [ ] Ingredient 수정 UI에 칼로리(kcal/100g) 입력 필드가 존재하고 저장됨
- [ ] Prep 수정/조회 UI에 총 칼로리(자동 계산)가 표시됨
- [ ] MenuItem 수정/조회 UI에 총 칼로리(자동 계산)가 표시됨
- [ ] 재료 칼로리 변경 시 연관 Prep/Menu의 표시 칼로리가 재계산됨

---

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 색상은 오픈/미들/마감 3개 고정 | 다른 유형 생기면? | ShiftType 인덱스 기반 동적 배정으로 결정 |
| 정렬은 시간만 | role 우선순위는? | 정직원 > 알바 먼저, 그 안에서 시간순 |
| 보충 이력은 프렙만 | 메뉴도 해당? | 메뉴도 포함, 날짜 선택 후 다중 선택으로 일괄 추가 |
| 칼로리는 저장 | 런타임 계산 vs 저장? | 런타임 계산 (ingredients 변경 시 항상 최신값) |
| 총량 = yieldAmount | 새 필드인가? | 기존 yieldAmount와 별개로 targetQuantity 추가 |

---

## Technical Context (Brownfield)

### 핵심 파일
- `src/domain/types.ts` — 타입 진실 소스 (Ingredient, Prep, MenuItem, ScheduleEntry, Employee, RestockRecord 수정)
- `src/pages/CreateSchedulePage.tsx` (1447줄) — 색상 로직(라인 809, 1109, 1257), 정렬 로직
- `src/pages/PrepsPage.tsx` — 총량 표시, 보충 메모 UI
- `src/pages/IngredientsPage.tsx` — 칼로리 필드 추가
- `src/pages/MenuPage.tsx` — 칼로리 표시, 보충 이력 탭
- `src/storage/restockRepo.ts` — memo 필드 추가
- `supabase/migrations/` — vacation_records, restock_history.memo 마이그레이션

### 현재 색상 시스템
```typescript
// CreateSchedulePage.tsx 라인 ~809
const tagColor = role === '정직원' ? 'blue' : 'orange'
// → 교체 대상: HSL 동적 계산 함수로
```

### 기존 재활용 가능 필드
- `Prep.yieldAmount?: number`, `Prep.yieldUnit?: string` — 이미 존재 (총량 UI 기반)
- `ScheduleEntry.note?: string` — 이미 존재 (메모 모아보기 기반)
- `restockDatesISO: string[]` — 보충 이력 기반 (memo 추가 필요)

### 마이그레이션 현황
- 최신 파일: `014_security_fix_rls.sql`
- 신규 필요: `015_vacation_records.sql`, `016_restock_memo.sql`

### Supabase MCP 활용 원칙
- 스키마 변경(vacation_records 신규, restock_history.memo 컬럼 추가)은 **Supabase MCP** (`mcp__claude_ai_Supabase__apply_migration`, `mcp__claude_ai_Supabase__execute_sql`)로 실제 적용
- 로컬 마이그레이션 파일(`supabase/migrations/`)도 동기화하여 코드 히스토리 유지
- ScheduleEntry.note, RestockRecord.memo, VacationRecord 등 메모성 데이터는 MCP로 테이블 상태 확인(`mcp__claude_ai_Supabase__list_tables`) 후 작업
- 타입 생성은 `mcp__claude_ai_Supabase__generate_typescript_types`로 적용 후 `src/domain/types.ts` 갱신

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Employee | core domain | id, name, role, hourlyWage, availableShiftIds | has many ScheduleEntries, VacationRecords |
| ShiftType | core domain | id, name, startTime, endTime, targetRole | mapped to ScheduleEntry, color index |
| ScheduleEntry | core domain | employeeId, shiftTypeId, date, note | belongs to ScheduleV3, has Employee+ShiftType |
| Prep | core domain | id, name, items, yieldAmount, targetQuantity, targetUnit | has many RestockRecords, PrepIngredientItems |
| Ingredient | supporting | id, name, purchasePrice, unitPrice, caloriesPer100g | used in Prep via PrepIngredientItem |
| MenuItem | core domain | id, name, ingredientItems, prepItems, calculatedCalories | composed of Prep+Ingredient |
| RestockRecord | supporting | id, prep_id, restock_date, memo | belongs to Prep or MenuItem |
| VacationRecord | supporting | id, employee_id, date, type, note | belongs to Employee |

---

## Interview Transcript
<details>
<summary>Full Q&A (2 rounds)</summary>

### Round 0 (Topology)
**Q:** 7개 독립 컴포넌트 구성 확인
**A:** 모두 진행 + 추가 명세 제공

### Round 1 (Clarifications)
**Q:** 추가 명세
**A:** (1) 색상: 오픈/미들/마감 고정 아닌 동적 배정. (2) 정렬: 정직원 먼저, 알바 나중. (4) 휴가: 상태 저장 및 이력 관리. (6) 보충: 수정창에서 보충이력 우선 탭, 캘린더 "리델리 보충" 제거, 날짜 선택+다중 선택 보충 추가.
**Ambiguity:** 13.6%
</details>

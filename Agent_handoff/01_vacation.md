# Vacation — LeeDeli

## Component Status
Describe the current state of each component. Update in-place during work.
Do not duplicate content.

### Vacation Management Tab
- **Current value/logic**: The vacation tab loads employees, vacation usage records, and leave grants (leave policy loading/auto-grant removed). Employee rows are sorted with 정직원 first, then 알바, and then name ascending within each role — same comparator now shared with the schedule settings tab via `compareEmployeesByRole`.
- **Implementation**: `VacationTabContent` renders an employee balance table, a "휴가 일괄 부여" card (bulk-grant button + modal), selected employee usage entry form (with free-typeable vacation type), usage history, and grant history management.
- **Related files**: `src/pages/VacationPage.tsx`, `src/storage/vacationRepo.ts`, `src/storage/leaveGrantsRepo.ts`, `src/utils/employees.ts`
- **Rationale**: Vacation balance is calculated as granted days minus used days, while grant history remains visible so managers can audit when and why leave was awarded.

### Leave Grant Rules → Bulk Grant (removed rule engine)
- **Current value/logic**: The old `LeavePolicy`-based automatic grant system (월/년/n일 주기 규칙 + 자동 부여 재실행) has been fully removed. In its place, the "휴가 일괄 부여" card shows two separate buttons — "전체 정직원에게 월차 부여" and "전체 정직원에게 연차 부여" — each opening its own single-field modal (only that type's day amount, no mixed 월차+연차 form). Confirming grants that amount to every 정직원 for the current month (월차, `grant_month='YYYY-MM'`) or current year (연차, `grant_month='YYYY'`), skipping anyone already granted for that period.
- **Implementation**: `handleBulkGrantByType(type: '월차' | '연차')` in `VacationPage.tsx` takes the type as a parameter, iterates `employees.filter(e => e.role === '정직원')`, checks `leaveGrants` for an existing record with the same `employee_id + leave_type + grant_month` before calling `addLeaveGrant(..., type)`. State is `bulkGrantType: '월차' | '연차' | null` (drives both which button was clicked and the modal's open/title/label) plus the shared `bulkGrantForm` with a single `amount` field. The `leave_type` column (added via migration `020_leave_grants_leave_type.sql`, applied to the live DB through the Supabase MCP `apply_migration` tool — **the migration file existed locally but had never been pushed to the remote project, which is what caused the initial 400 Bad Request errors on grant submission**) records whether a grant is 월차/연차/etc. so the UI no longer depends on `rule_id`/`leave_policies`.
- **Related files**: `src/pages/VacationPage.tsx`, `src/domain/types.ts`, `src/storage/leaveGrantsRepo.ts`, `supabase/migrations/020_leave_grants_leave_type.sql`
- **Rationale**: User first asked to remove the rule engine ("규칙은 필요없어") for a simple manual bulk-grant action, then explicitly asked to keep 월차 and 연차 grants as separate actions ("월차랑 연차를 따로 부여하고 싶어") rather than one combined form — separating them also avoids accidentally granting one type while only intending the other. DB cleanup was scoped to code only — the `leave_policies` table and `leave_grants.rule_id` column remain in the DB (legacy data still renders as "알 수 없는 규칙" if `rule_id` is present with no `leave_type`), but `leavePoliciesRepo.ts` was deleted and `LeavePolicy` removed from `domain/types.ts`.

### Leave Grant History
- **Current value/logic**: Selected employee grant records are filtered from `leave_grants` and displayed with a human-readable period (`formatGrantPeriod`), amount, source label, and optional note. Source label resolves as `leave_type ?? (rule_id ? '알 수 없는 규칙' : '수동 조정')`.
- **Implementation**: `formatGrantPeriod(grantMonth, createdAt)` converts `grant_month` into display text based on its format — `YYYY-MM-DD` shown as-is, `YYYY-MM` → `"YYYY년 M월"`, `YYYY` → `"YYYY년"`, and any other internal key (e.g. legacy manual-adjustment keys like `adj-20260606140359-268e71`) falls back to `created_at` formatted as plain `"YYYY-MM-DD"` (no trailing label — user explicitly said the "부여" suffix wasn't needed, just the date). This fixed a display bug where raw internal adjustment keys leaked into the UI. Individual grants can be deleted, and all selected employee grant records can be initialized after a warning that the remaining vacation balance will be reduced.
- **Related files**: `src/pages/VacationPage.tsx`, `src/domain/types.ts`, `src/storage/leaveGrantsRepo.ts`
- **Rationale**: Existing persisted grant data (including legacy rows with garbled `grant_month` keys) needed a presentation-layer fix without any data migration.

### Bulk Reset (전체 직원 휴가 초기화)
- **Current value/logic**: A "전체 직원 휴가 초기화" card sits right under the bulk-grant card with two independent danger buttons — "전체 직원 부여 기록 초기화" and "전체 직원 사용 기록 초기화" — each wrapped in its own `Popconfirm` (separate confirmations, NOT a combined reset, per explicit user preference "부여 따로 사용기록 따로 하나씩"). The grant-reset confirmation shows the live count and total days (`부여 기록 N건(총 M일)이...`); the usage-reset confirmation shows the live record count (`사용 기록 N건이...`). Both buttons are `disabled` when their respective collection is empty.
- **Implementation**: `handleResetAllGrants`/`handleResetAllUsage` each `Promise.all`-delete every row in `leaveGrants`/`allVacations` via `deleteLeaveGrant`/`deleteVacation`, share a single `allResetLoading` boolean, then `refresh()` and show a `message.success`. `totalGrantedDays = leaveGrants.reduce((sum, g) => sum + g.amount, 0)` feeds the grant-reset description text.
- **Related files**: `src/pages/VacationPage.tsx`, `src/storage/leaveGrantsRepo.ts`, `src/storage/vacationRepo.ts`
- **Rationale**: The page already had a single-employee balance reset; the user asked for an all-employee equivalent ("모든 직원의 휴가 초기화 버튼도 필요") and, when asked to clarify scope, explicitly chose two independent actions over one combined reset so an admin can wipe grants without touching usage history (or vice versa).

### Vacation Type Entry
- **Current value/logic**: The "휴가 추가" type field is no longer a fixed `VACATION_TYPES` list — it always offers 월차/연차 plus any type previously used, and also accepts free-typed custom values.
- **Implementation**: `vacationTypeOptions = Array.from(new Set(['월차', '연차', ...allVacations.map(v => v.type)]))` feeds an antd `Select` with `mode="tags" maxCount={1}`; since tags-mode returns an array, `onAdd` extracts the single value via `Array.isArray(rawType) ? rawType[0] : rawType`.
- **Related files**: `src/pages/VacationPage.tsx`
- **Rationale**: User wanted 월차/연차 to always be selectable and the ability to type new vacation type names directly, without maintaining a separate types table.

### Role Color Display
- **Current value/logic**: Vacation employee role tags use the same full-time and part-time palette colors as the schedule settings page.
- **Implementation**: `VacationPage.tsx` imports `FULL_TIME_PALETTE` and `PART_TIME_PALETTE` from `src/utils/shiftColors.ts`.
- **Related files**: `src/pages/VacationPage.tsx`, `src/utils/shiftColors.ts`
- **Rationale**: Shared palette usage keeps role labels visually consistent across schedule setup and vacation management.

---

## Change History
Record only deltas. Do not repeat content already in Component Status.

| Timestamp | Task | Change Summary |
|-----------|------|----------------|
| 2026-06-06 02:45 | Vacation grant audit display | vacation tab → usage-only selected employee history → usage history plus read-only grant history; employee balance table → name-only sort/default role tag → role-first sort and shared role palette colors |
| 2026-06-06 03:01 | Vacation grant deletion controls | grant history display → policy type tags removed; grant records → individual delete and selected employee full reset with balance reduction warning; manual balance edit → zero value accepted |
| 2026-06-06 (이번 세션) | 휴가 부여 규칙 제거 + 일괄 부여 전환, 표시 버그 수정 | "휴가 부여 규칙" 카드/자동 부여 useEffect/`LeavePolicy` 전체 제거 → "휴가 일괄 부여" 카드 + `handleBulkGrantToFullTime`(모달에서 일수 입력 → 정직원 전원에게 월차/연차 부여, 중복 건너뜀) 신설; `leave_grants`에 `leave_type` 컬럼 추가(`020_leave_grants_leave_type.sql`)로 부여 출처를 직접 기록; 부여 기록 표시 → `formatGrantPeriod`로 `grant_month`를 사람이 읽을 수 있는 기간으로 변환(내부 키 `adj-...` 노출 버그 수정), `sourceLabel`을 `leave_type` 기반으로 변경; "휴가 추가" 유형 선택 → 고정 `VACATION_TYPES` 제거, `Select mode="tags" maxCount={1}`로 월차/연차 상시 노출 + 직접 입력 가능; 직원 정렬 비교 함수를 `src/utils/employees.ts`의 `compareEmployeesByRole`로 추출해 `CreateSchedulePage.tsx` 설정 탭과 공유(정직원이 항상 알바 위에 표시); `leavePoliciesRepo.ts` 삭제, `LeavePolicy` 타입 제거(DB의 `leave_policies` 테이블·`rule_id` 컬럼은 유지) |
| 2026-06-06 (후속 수정) | 부여 버튼 동작 안 함 수정 + 월차/연차 분리 + 표시 문구 정리 | 부여 클릭 시 400 에러로 실패 → 원인은 `020_leave_grants_leave_type.sql` 마이그레이션 파일이 로컬에만 있고 실제 Supabase 프로젝트(`tmmkdqpiolyldhngysxh`)엔 적용된 적이 없어 `leave_type` 컬럼이 DB에 부재했던 것 → Supabase MCP `apply_migration`으로 원격 DB에 적용해 해결; "전체 정직원에게 월차·연차 부여" 단일 버튼+모달(`handleBulkGrantToFullTime`, `bulkGrantModalOpen`) → "전체 정직원에게 월차 부여"/"전체 정직원에게 연차 부여" 분리 버튼+단일 필드 모달(`handleBulkGrantByType(type)`, `bulkGrantType: '월차'|'연차'|null`)로 교체(따로 부여하고 싶다는 요청); `formatGrantPeriod` 내부 키 폴백 표기 → `"YYYY-MM-DD 부여"` → `"YYYY-MM-DD"`("부여" 문구 불필요 요청) |
| 2026-06-06 (전체 초기화 추가) | 전체 직원 휴가 초기화 버튼 신설 | "모든 직원의 휴가 초기화 버튼도 필요" 요청에 따라 일괄 부여 카드 아래 "전체 직원 휴가 초기화" 카드 신설 → "전체 직원 부여 기록 초기화"/"전체 직원 사용 기록 초기화" 두 개의 독립된 `danger` 버튼 + 개별 `Popconfirm`으로 구성(사용자가 "부여 따로 사용기록 따로 하나씩"으로 명시적 선택, 통합 초기화 아님); `handleResetAllGrants`/`handleResetAllUsage`가 각각 `leaveGrants`/`allVacations` 전체를 `Promise.all`로 삭제, 공용 `allResetLoading` 상태와 `totalGrantedDays` 합계로 확인 문구에 실시간 건수·일수 표시 |

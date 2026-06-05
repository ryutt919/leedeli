# Vacation — LeeDeli

## Component Status
Describe the current state of each component. Update in-place during work.
Do not duplicate content.

### Vacation Management Tab
- **Current value/logic**: The vacation tab loads employees, vacation usage records, leave grants, and leave policies. Employee rows are sorted with 정직원 first, then 알바, and then name ascending within each role.
- **Implementation**: `VacationTabContent` renders an employee balance table, leave policy management, selected employee usage entry form, usage history, and grant history management.
- **Related files**: `src/pages/VacationPage.tsx`, `src/storage/vacationRepo.ts`, `src/storage/leaveGrantsRepo.ts`, `src/storage/leavePoliciesRepo.ts`
- **Rationale**: Vacation balance is calculated as granted days minus used days, while grant history remains visible so managers can audit when and why leave was awarded.

### Leave Grant History
- **Current value/logic**: Selected employee grant records are filtered from `leave_grants` and displayed by `grant_month`, amount, policy label, and optional note. Records with no `rule_id` are displayed as manual adjustments.
- **Implementation**: Grant records are matched to loaded `leave_policies` in the UI. Deleted or unavailable policies are shown as unknown rules. Individual grants can be deleted, and all selected employee grant records can be initialized after a warning that the remaining vacation balance will be reduced.
- **Related files**: `src/pages/VacationPage.tsx`, `src/domain/types.ts`, `src/storage/leaveGrantsRepo.ts`
- **Rationale**: Existing persisted grant data is sufficient for audit display, so no schema change is required.

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

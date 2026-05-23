export type Id = string

export type YearMonth = {
  year: number
  month: number // 1-12
}

export type WorkRules = {
  DAILY_STAFF_BASE: number // 1 step
  DAILY_STAFF_MAX: number // 1 step
  WORK_HOURS: number
  BREAK_HOURS: number
}

export type Shift = 'open' | 'middle' | 'close'

// 새로운 근무 타입 (시간 고정)
export type ShiftCode = 'O_F' | 'O_H' | 'M_F' | 'M_H' | 'C_F' | 'C_H' | 'OFF'

export type ShiftBlock = 'O' | 'M' | 'C'

export type StaffMember = {
  id: Id
  name: string
  availableShifts: Shift[]
  requiredShift?: Shift
  preferredShift?: Shift
  priority: Record<Shift, number> // higher is better
}

export type DayRequest = {
  dateISO: string // YYYY-MM-DD
  offStaffIds: Id[]
  halfStaff: Array<{ staffId: Id; shift: Shift }>
  /**
   * 날짜별 필요 인원 조정값(근무 규칙 DAILY_STAFF_BASE 대비 Δ).
   * - 0.5 단위(0, 0.5, 1.0 ...)
   * - 실제 필요 인원 = clamp(BASE + Δ, BASE, MAX)
   */
  needDelta: number
  /** @deprecated 하위 호환용(구버전 데이터) */
  needBoost?: boolean
}

export type ScheduleAssignment = {
  dateISO: string
  byShift: Record<Shift, Array<{ staffId: Id; unit: 1 | 0.5 }>>
}

export type ScheduleStats = {
  staffId: Id
  name: string
  offDays: number
  halfDays: number
  fullDays: number
  workUnits: number // full=1, half=0.5
}

export type SavedSchedule = {
  id: Id
  /**
   * 스케줄 기간(포함 범위)
   * - YYYY-MM-DD
   */
  startDateISO: string
  endDateISO: string
  /**
   * @deprecated (하위 호환/표시용) startDateISO 기준의 연/월
   * - 기간 스케줄(월/년도 넘어감)에서도 startDateISO의 연/월이 들어갑니다.
   */
  year: number
  /** @deprecated (하위 호환/표시용) startDateISO 기준의 월(1-12) */
  month: number // 1-12
  createdAtISO: string
  updatedAtISO: string
  workRules: WorkRules
  staff: StaffMember[]
  requests: DayRequest[]
  assignments: ScheduleAssignment[]
  stats: ScheduleStats[]
  editSourceScheduleId?: Id
}

export type Ingredient = {
  id: Id
  name: string
  purchasePrice: number
  purchaseUnit: number
  unitPrice: number
  /**
   * 재료 단위 라벨(문자열)
   * - 예: g, 개, 장, ml ...
   * - 미입력 시 기본은 'g'로 간주(UI/표시에서 처리)
   */
  unitLabel?: string
  /** @deprecated (구버전) */
  unitType?: 'g' | 'ea'
  updatedAtISO: string
  category?: string
}

export type PrepIngredientItem = {
  ingredientId: Id
  ingredientName: string
  amount: number
}

export type Prep = {
  id: Id
  name: string
  items: PrepIngredientItem[]
  restockDatesISO: string[]
  updatedAtISO: string
  category?: string
  yieldAmount?: number
  yieldUnit?: string
}

// Supabase restock_history 테이블에 대응하는 보충 이력 레코드 타입
export type RestockRecord = {
  id: string
  prep_id: string
  user_email: string
  restock_date: string // YYYY-MM-DD
  created_at: string
}


export type MenuIngredientItem = {
  ingredientId: Id
  ingredientName: string
  amount: number
}

export type MenuPrepItem = {
  prepId: Id
  prepName: string
  amount: number
  unitLabel: string
}

export type MenuItem = {
  id: Id
  name: string
  category?: string
  ingredientItems: MenuIngredientItem[]
  prepItems: MenuPrepItem[]
  updatedAtISO: string
}

export type ExtraWork = {
  id: Id
  scheduleId: Id
  dateISO: string
  staffId: Id
  hours: number
  note?: string
  createdAtISO: string
}

// ─── 스케줄 V3 (신규 시스템) ─────────────────────────────────────

export type EmployeeRole = '정직원' | '알바'

export type WorkPattern = {
  weekdays: number[]   // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  startTime: string    // HH:MM
  endTime: string      // HH:MM
  breakMinutes: number
}

export type Employee = {
  id: Id
  name: string
  role: EmployeeRole
  hourlyWage: number
  defaultBreakMinutes: number
  availableShiftIds: Id[]     // 정직원: 가능한 ShiftType id 목록
  regularDaysOff: number[]    // 개인 주간 정기휴무 요일 (0-6)
  workPatterns: WorkPattern[] // 알바: 요일별 고정 근무패턴
  updatedAtISO: string
}

export type ShiftType = {
  id: Id
  name: string
  startTime: string    // HH:MM
  endTime: string      // HH:MM
  breakMinutes: number
  staffCount: number   // 하루 필요 인원 수
  updatedAtISO: string
}

export type ScheduleEntry = {
  id: Id
  employeeId: Id
  employeeName: string
  shiftTypeId?: Id
  shiftTypeName?: string
  startTime: string    // HH:MM
  endTime: string      // HH:MM
  breakMinutes: number
  note?: string
}

export type ScheduleV3 = {
  id: Id
  name: string
  startDateISO: string
  endDateISO: string
  regularDaysOff: number[]                   // 스케줄 전체 정기휴무 요일
  entries: Record<string, ScheduleEntry[]>   // dateISO → 해당일 배정 목록
  employees: Employee[]                      // 생성 시점 직원 스냅샷
  shiftTypes: ShiftType[]                    // 생성 시점 근무유형 스냅샷
  createdAtISO: string
  updatedAtISO: string
}

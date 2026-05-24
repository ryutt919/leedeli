import type { Employee, ScheduleEntry, ScheduleV3, ShiftType, WeekPreset } from './types'

function generateId(): string {
  return crypto.randomUUID()
}

function dateRange(startISO: string, endISO: string): string[] {
  const dates: string[] = []
  const start = new Date(startISO)
  const end = new Date(endISO)
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function calcWorkMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const total = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, total - breakMinutes)
}

export function calcEmployeeSummary(
  schedule: ScheduleV3,
  employeeId: string,
  hourlyWage: number
): { totalDays: number; totalHours: number; totalWage: number } {
  let totalMinutes = 0
  let totalDays = 0
  for (const dayEntries of Object.values(schedule.entries)) {
    const mine = dayEntries.filter((e) => e.employeeId === employeeId)
    if (mine.length > 0) {
      totalDays++
      for (const e of mine) {
        totalMinutes += calcWorkMinutes(e.startTime, e.endTime, e.breakMinutes)
      }
    }
  }
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10
  const totalWage = Math.round((totalMinutes / 60) * hourlyWage)
  return { totalDays, totalHours, totalWage }
}

export function generateScheduleV3(config: {
  employees: Employee[]
  shiftTypes: ShiftType[]
  startDateISO: string
  endDateISO: string
  regularDaysOff: number[]
  scheduleName?: string
  weekPresetMap?: Record<number, WeekPreset>
}): ScheduleV3 {
  const { employees, shiftTypes, startDateISO, endDateISO, regularDaysOff, weekPresetMap } = config
  const startMs = new Date(startDateISO).getTime()

  // shiftTypeId → employeeId → count (배정 균등화용)
  const assignCount: Record<string, Record<string, number>> = {}
  for (const st of shiftTypes) {
    assignCount[st.id] = {}
    for (const emp of employees) {
      assignCount[st.id][emp.id] = 0
    }
  }

  const entries: Record<string, ScheduleEntry[]> = {}

  for (const dateISO of dateRange(startDateISO, endDateISO)) {
    const dOW = new Date(dateISO + 'T00:00:00').getDay()
    if (regularDaysOff.includes(dOW)) continue

    // Determine week index (0-based, 7-day blocks from schedule start)
    const dayIndex = Math.floor((new Date(dateISO).getTime() - startMs) / 86400000)
    const weekIndex = Math.floor(dayIndex / 7)

    // Apply week preset: check per-week override first, then fall back to default dayConfig
    let activeShiftTypes = shiftTypes
    const activePreset = weekPresetMap?.[weekIndex]
    if (activePreset) {
      const presetConfig: string[] | undefined =
        activePreset.weekOverrides?.[weekIndex]?.[dOW] ?? activePreset.dayConfig[dOW]
      if (presetConfig !== undefined) {
        if (presetConfig.length === 0) continue
        activeShiftTypes = shiftTypes.filter((st) => presetConfig.includes(st.id))
      }
    }

    const dayEntries: ScheduleEntry[] = []
    // 하루에 같은 직원이 두 번 배정되지 않도록 추적
    const assignedTodayIds = new Set<string>()

    for (const st of activeShiftTypes) {
      const eligible = employees.filter(
        (emp) =>
          emp.availableShiftIds.includes(st.id) &&
          !emp.regularDaysOff.includes(dOW) &&
          !assignedTodayIds.has(emp.id)
      )
      // least-recently-assigned 우선 정렬
      const sorted = [...eligible].sort(
        (a, b) => (assignCount[st.id][a.id] ?? 0) - (assignCount[st.id][b.id] ?? 0)
      )
      const toAssign = sorted.slice(0, st.staffCount)
      for (const emp of toAssign) {
        dayEntries.push({
          id: generateId(),
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTypeId: st.id,
          shiftTypeName: st.name,
          startTime: st.startTime,
          endTime: st.endTime,
          breakMinutes: st.breakMinutes,
        })
        assignCount[st.id][emp.id] = (assignCount[st.id][emp.id] ?? 0) + 1
        assignedTodayIds.add(emp.id)
      }
    }

    if (dayEntries.length > 0) {
      entries[dateISO] = dayEntries
    }
  }

  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: config.scheduleName ?? `${startDateISO} ~ ${endDateISO}`,
    startDateISO,
    endDateISO,
    regularDaysOff,
    entries,
    employees,
    shiftTypes,
    createdAtISO: now,
    updatedAtISO: now,
  }
}

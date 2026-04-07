import { describe, it, expect } from 'vitest'
import { generateSchedule } from '../../src/domain/scheduleEngine'
import type { ScheduleInputs, DayRequest } from '../../src/domain/types'

describe('scheduleEngine dynamic headcount', () => {
  const baseStaff = [
    { id: '1', name: 'A', availableShifts: ['open', 'middle', 'close'], priority: { open: 1, middle: 1, close: 1 } },
    { id: '2', name: 'B', availableShifts: ['open', 'middle', 'close'], priority: { open: 1, middle: 1, close: 1 } },
    { id: '3', name: 'C', availableShifts: ['open', 'middle', 'close'], priority: { open: 1, middle: 1, close: 1 } },
    { id: '4', name: 'D', availableShifts: ['open', 'middle', 'close'], priority: { open: 1, middle: 1, close: 1 } },
  ] as any[]

  const workRules = {
    DAILY_STAFF_BASE: 2,
    DAILY_STAFF_MAX: 4,
    WORK_HOURS: 8,
    BREAK_HOURS: 1,
  }

  it('should apply needDelta to increase headcount', () => {
    const input: ScheduleInputs = {
      startDateISO: '2026-04-07',
      endDateISO: '2026-04-07',
      workRules,
      staff: baseStaff.slice(0, 3), // 3 staff available
      requests: [
        { dateISO: '2026-04-07', offStaffIds: [], halfStaff: [], needDelta: 0 }
      ]
    }

    // Base 2, Delta 0, Available 3 -> Target 3 (Min 2, Max 2, but available is 3? Wait, dailyMax should be 2)
    // Actually baseMax is 4 in the test setup. 
    // dailyMax = Math.max(dailyMin, Math.floor(baseMax + req.needDelta))
    // dailyMax = Math.max(2, 4 + 0) = 4.
    // So targetHeadcount = Math.min(4, 3) = 3.
    const { assignments: a1 } = generateSchedule(input)
    expect(Object.values(a1[0].byShift).flat().length).toBe(3)

    // Base 2, Delta 1, Available 3 -> Target 3
    input.requests[0].needDelta = 1
    const { assignments: a2 } = generateSchedule(input)
    expect(Object.values(a2[0].byShift).flat().length).toBe(3)
  })

  it('should not assign middle shift when targetHeadcount < 3', () => {
    const input: ScheduleInputs = {
      startDateISO: '2026-04-07',
      endDateISO: '2026-04-07',
      workRules,
      staff: baseStaff.slice(0, 2), // 2 staff
      requests: [
        { dateISO: '2026-04-07', offStaffIds: [], halfStaff: [], needDelta: 0 }
      ]
    }

    const { assignments } = generateSchedule(input)
    const daily = assignments[0]
    expect(daily.byShift.open.length).toBeGreaterThan(0)
    expect(daily.byShift.close.length).toBeGreaterThan(0)
    expect(daily.byShift.middle.length).toBe(0)
  })

  it('should throw error when available staff < dailyMin', () => {
    const input: ScheduleInputs = {
      startDateISO: '2026-04-07',
      endDateISO: '2026-04-07',
      workRules,
      staff: baseStaff,
      requests: [
        { dateISO: '2026-04-07', offStaffIds: ['1', '2', '3'], halfStaff: [], needDelta: 0 }
      ]
    }

    // Min 2, Available 1 -> Should Fail
    expect(() => generateSchedule(input)).toThrow(/가용 인원\(1명\) < 최소 필요 인원\(2명\)/)
  })

  it('should handle targetHeadcount >= 3 by assigning middle shift', () => {
     const input: ScheduleInputs = {
      startDateISO: '2026-04-07',
      endDateISO: '2026-04-07',
      workRules,
      staff: baseStaff,
      requests: [
        { dateISO: '2026-04-07', offStaffIds: [], halfStaff: [], needDelta: 1 }
      ]
    }

    const { assignments } = generateSchedule(input)
    const daily = assignments[0]
    expect(daily.byShift.open.length).toBeGreaterThan(0)
    expect(daily.byShift.middle.length).toBeGreaterThan(0)
    expect(daily.byShift.close.length).toBeGreaterThan(0)
  })
})

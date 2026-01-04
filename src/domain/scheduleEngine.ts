import type { DayRequest, SavedSchedule, ScheduleAssignment, ScheduleStats, Shift, ShiftCode, ShiftBlock, StaffMember, WorkRules } from './types'
import dayjs from 'dayjs'
import { daysInRangeISO, isISODate } from '../utils/date'

export type ScheduleInputs = {
  startDateISO: string
  endDateISO: string
  workRules: WorkRules
  staff: StaffMember[]
  requests: DayRequest[]
}

// 근무 타입별 근무 시간 (시간 단위)
const SHIFT_HOURS: Record<ShiftCode, number> = {
  O_F: 8, // 08:00-17:00, 휴게 1h
  O_H: 4, // 08:00-12:00
  M_F: 8, // 11:00-20:00, 휴게 1h
  M_H: 4, // 11:00-15:00
  C_F: 8, // 12:30-21:30, 휴게 1h
  C_H: 4, // 17:30-21:30
  OFF: 0,
}

// ShiftCode -> ShiftBlock 매핑
function getShiftBlock(code: ShiftCode): ShiftBlock | null {
  if (code === 'OFF') return null
  if (code.startsWith('O_')) return 'O'
  if (code.startsWith('M_')) return 'M'
  if (code.startsWith('C_')) return 'C'
  return null
}

// Shift -> ShiftBlock 매핑 (기존 타입과의 호환성)
function shiftToBlock(shift: Shift): ShiftBlock {
  if (shift === 'open') return 'O'
  if (shift === 'middle') return 'M'
  return 'C'
}

// ShiftBlock -> Shift 매핑 (기존 타입과의 호환성)
function blockToShift(block: ShiftBlock): Shift {
  if (block === 'O') return 'open'
  if (block === 'M') return 'middle'
  return 'close'
}

export function validateScheduleInputs(input: ScheduleInputs): string[] {
  const errs: string[] = []
  if (!isISODate(input.startDateISO)) errs.push('시작일이 올바르지 않습니다.')
  if (!isISODate(input.endDateISO)) errs.push('종료일이 올바르지 않습니다.')
  if (isISODate(input.startDateISO) && isISODate(input.endDateISO)) {
    const s = dayjs(input.startDateISO, 'YYYY-MM-DD', true)
    const e = dayjs(input.endDateISO, 'YYYY-MM-DD', true)
    if (e.isBefore(s, 'day')) errs.push('종료일은 시작일 이후여야 합니다.')
    if (e.diff(s, 'day') > 370) errs.push('기간이 너무 깁니다. 371일 이내로 선택하세요.')
  }
  if (!input.staff.length) errs.push('직원이 1명 이상 필요합니다.')
  for (const s of input.staff) {
    if (!s.name.trim()) errs.push('직원 이름이 비었습니다.')
    if (!s.availableShifts.length) errs.push(`${s.name || '(이름없음)'}: 가능 시프트를 1개 이상 선택하세요.`)
    if (s.requiredShift && !s.availableShifts.includes(s.requiredShift)) errs.push(`${s.name}: 필수 시프트가 가능 시프트에 포함되어야 합니다.`)
    if (s.preferredShift && !s.availableShifts.includes(s.preferredShift)) errs.push(`${s.name}: 선호 시프트가 가능 시프트에 포함되어야 합니다.`)
  }
  for (const req of input.requests) {
    for (const h of req.halfStaff) {
      const s = input.staff.find(st => st.id === h.staffId);
      if (!s) {
        errs.push(`halfStaff: ${h.staffId} 직원 정보가 없습니다.`);
        continue;
      }
      if (!s.availableShifts.includes(h.shift)) {
        errs.push(`${s.name}: halfStaff로 요청한 시프트(${h.shift})는 해당 직원의 가능 시프트에 없습니다.`);
      }
      if (s.requiredShift && s.requiredShift !== h.shift) {
        errs.push(`${s.name}: halfStaff로 요청한 시프트(${h.shift})가 필수 시프트와 다릅니다.`);
      }
    }
  }
  if (input.workRules.DAILY_STAFF_BASE < 1) errs.push('기본 근무 인원은 1명 이상이어야 합니다.')
  if (input.workRules.DAILY_STAFF_MAX < input.workRules.DAILY_STAFF_BASE) errs.push('최대 근무 인원은 기본 이상이어야 합니다.')
  if (input.workRules.WORK_HOURS <= 0) errs.push('근무시간이 올바르지 않습니다.')
  if (input.workRules.BREAK_HOURS < 0) errs.push('휴게시간이 올바르지 않습니다.')
  // DAILY_STAFF_* must be integers (no half-staff units)
  if (!Number.isInteger(input.workRules.DAILY_STAFF_BASE)) errs.push('기본 근무 인원은 정수여야 합니다.')
  if (!Number.isInteger(input.workRules.DAILY_STAFF_MAX)) errs.push('최대 근무 인원은 정수여야 합니다.')
  return errs
}

// 최근 14일간 특정 블록 배정 횟수 계산
function getRecentBlockCount(
  staffId: string,
  block: ShiftBlock,
  dateISO: string,
  assignments: Map<string, ScheduleAssignment>
): number {
  const date = dayjs(dateISO)
  let count = 0
  for (let i = 1; i <= 14; i++) {
    const checkDate = date.subtract(i, 'day').format('YYYY-MM-DD')
    const asg = assignments.get(checkDate)
    if (!asg) continue
    const shift = blockToShift(block)
    const hasAssignment = asg.byShift[shift].some(x => x.staffId === staffId)
    if (hasAssignment) count++
  }
  return count
}

export function generateSchedule(input: ScheduleInputs): { assignments: ScheduleAssignment[]; stats: ScheduleStats[] } {
  const dates = daysInRangeISO(input.startDateISO, input.endDateISO)
  const reqByDate = new Map(input.requests.map((r) => [r.dateISO, r]))
  const assignmentsByDate = new Map<string, ScheduleAssignment>()
  const workload = new Map<string, number>()
  const nameById = new Map(input.staff.map((s) => [s.id, s.name]))

  const assignments: ScheduleAssignment[] = []

  for (const dateISO of dates) {
    const req = reqByDate.get(dateISO) ?? {
      dateISO,
      offStaffIds: [],
      halfStaff: [],
      needDelta: 0,
    } satisfies DayRequest

    // 날짜별 delta(정수 단위) 계산 (현재는 사용되지 않음)
    // Enforce integer headcounts: floor any fractional values to avoid 0.5 units
    const minBase = Math.floor(input.workRules.DAILY_STAFF_BASE)
    const maxBase = Math.floor(input.workRules.DAILY_STAFF_MAX)

    // 가용 직원 (OFF 아님)
    const availableStaff = input.staff.filter(s => !req.offStaffIds.includes(s.id))
    const availableCount = availableStaff.length

    // 불가능 판정: 가용 인원 < 최소인원 => 에러
    if (availableCount < minBase) {
      throw new Error(`${dateISO}: 가용 인원(${availableCount}명) < 최소 필요 인원(${minBase}명)`)
    }

    // 목표 배정 인원: 가능한 최대인원에 가깝게(우선 최대를 시도)
    const targetHeadcount = Math.min(maxBase, availableCount)

    const hasOpenCapable = availableStaff.some(s => s.availableShifts.includes('open'))
    const hasCloseCapable = availableStaff.some(s => s.availableShifts.includes('close'))
    if (!hasOpenCapable || !hasCloseCapable) {
      throw new Error(`${dateISO}: 오픈 또는 마감 가능 인원이 없습니다`)
    }

    if (targetHeadcount >= 3) {
      const hasMiddleCapable = availableStaff.some(s => s.availableShifts.includes('middle'))
      if (!hasMiddleCapable) {
        throw new Error(`${dateISO}: 필요 인원 ${targetHeadcount}명이지만 미들 가능 인원이 없습니다`)
      }
    }

    // allowed_shifts 계산 (개인별, 날짜별)
    const allowedShifts = new Map<string, Set<ShiftCode>>()
    for (const staff of availableStaff) {
      const allowed = new Set<ShiftCode>()
      const halfRequest = req.halfStaff.find(h => h.staffId === staff.id)

      if (halfRequest) {
        // half 요청은 우선적으로 해당 블록의 하프를 허용하되,
        // 가능한 유연성을 위해 다른 블록의 F/H도 허용하도록 변경
        const halfReqBlock = shiftToBlock(halfRequest.shift)
        allowed.add(`${halfReqBlock}_H` as ShiftCode)
        for (const shift of staff.availableShifts) {
          const block = shiftToBlock(shift)
          allowed.add(`${block}_F` as ShiftCode)
          allowed.add(`${block}_H` as ShiftCode)
        }
      } else {
        for (const shift of staff.availableShifts) {
          const block = shiftToBlock(shift)
          allowed.add(`${block}_F` as ShiftCode)
          allowed.add(`${block}_H` as ShiftCode)
        }
      }
      allowedShifts.set(staff.id, allowed)
    }

    // preferred 블록 계산
    const preferred = new Map<string, ShiftBlock | null>()
    for (const staff of availableStaff) {
      if (staff.preferredShift) {
        preferred.set(staff.id, shiftToBlock(staff.preferredShift))
      } else {
        preferred.set(staff.id, null)
      }
    }

    // 배정 결과
    const assigned = new Set<string>()
    const dailyAssignments: Map<string, ShiftCode> = new Map()

    // 1. 필수 슬롯 확보
    const assignSlot = (block: ShiftBlock, prioritizePreferred: boolean = true): boolean => {
      const candidates = availableStaff.filter(s => {
        if (assigned.has(s.id)) return false
        const allowed = allowedShifts.get(s.id) ?? new Set()
        // 해당 블록의 시프트 중 하나라도 가능한지
        return Array.from(allowed).some(code => getShiftBlock(code) === block)
      })

      if (candidates.length === 0) return false

      // 선호자 우선
      let pool = candidates
      if (prioritizePreferred) {
        const preferredCandidates = candidates.filter(s => preferred.get(s.id) === block)
        if (preferredCandidates.length > 0) {
          pool = preferredCandidates
        }
      }

      // 우선순위: 최근 14일간 해당 블록 배정 횟수가 적은 사람
      pool.sort((a, b) => {
        const countA = getRecentBlockCount(a.id, block, dateISO, assignmentsByDate)
        const countB = getRecentBlockCount(b.id, block, dateISO, assignmentsByDate)
        return countA - countB
      })

      const selected = pool[0]
      if (!selected) return false

      // 시프트 코드 선택: half 요청이면 _H, 아니면 _F 우선
      const allowed = allowedShifts.get(selected.id) ?? new Set()
      const blockCodes = Array.from(allowed).filter(code => getShiftBlock(code) === block)
      
      let shiftCode: ShiftCode | null = null
      const halfRequest = req.halfStaff.find(h => h.staffId === selected.id)
      if (halfRequest) {
        shiftCode = blockCodes.find(code => code.endsWith('_H')) ?? null
      } else {
        shiftCode = blockCodes.find(code => code.endsWith('_F')) ?? blockCodes[0] ?? null
      }

      if (!shiftCode) return false

      assigned.add(selected.id)
      dailyAssignments.set(selected.id, shiftCode)
      return true
    }

    // 오픈 1명
    if (!assignSlot('O')) {
      // 진단 정보 출력
      const diag = availableStaff.map(s => ({ id: s.id, name: s.name, availableShifts: s.availableShifts })).slice(0, 50)
      console.error('assign failed (O)', { dateISO, targetHeadcount, availableCount, assigned: Array.from(assigned), diag })
      throw new Error(`${dateISO}: 오픈 배정 실패 - 진단정보 콘솔 확인`)
    }

    // 마감 1명
    if (!assignSlot('C')) {
      const diag = availableStaff.map(s => ({ id: s.id, name: s.name, availableShifts: s.availableShifts })).slice(0, 50)
      console.error('assign failed (C)', { dateISO, targetHeadcount, availableCount, assigned: Array.from(assigned), diag })
      throw new Error(`${dateISO}: 마감 배정 실패 - 진단정보 콘솔 확인`)
    }

    // target>=3이면 미들 1명
    if (targetHeadcount >= 3) {
      if (!assignSlot('M')) {
        // 상세 진단: 후보자, 허용 시프트, half 요청, 선호
        const iso = dateISO
        const halfMap = new Map(req.halfStaff.map(h => [h.staffId, h.shift]))
        const candidates = availableStaff
          .filter(s => {
            if (assigned.has(s.id)) return false
            const allowed = allowedShifts.get(s.id) ?? new Set()
            return Array.from(allowed).some(code => getShiftBlock(code) === 'M')
          })
          .map(s => ({ id: s.id, name: s.name, availableShifts: s.availableShifts, halfRequest: halfMap.get(s.id) ?? null, preferred: preferred.get(s.id) ?? null }))

        console.error('미들 배정 실패 진단', { dateISO: iso, targetHeadcount, availableCount, assigned: Array.from(assigned), candidates, req })

        // 추가로 각 후보별 허용 코드까지 보여줌
        const allowDetail = availableStaff.map(s => ({ id: s.id, name: s.name, allowed: Array.from(allowedShifts.get(s.id) ?? []) }))
        console.error('허용 코드 상세', allowDetail)

        throw new Error(`${dateISO}: 미들 배정 실패 (필요 인원 ${targetHeadcount}명) - 진단정보 콘솔 확인`)
      }
    }

    // 2. 남은 헤드카운트 채우기
    while (assigned.size < targetHeadcount) {
      const remaining = availableStaff.filter(s => !assigned.has(s.id))
      if (remaining.length === 0) break

      let bestStaff: StaffMember | null = null
      let bestBlock: ShiftBlock | null = null

      // 각 직원의 선호 블록부터 시도
      for (const staff of remaining) {
        const allowed = allowedShifts.get(staff.id) ?? new Set()
        const pref = preferred.get(staff.id)
        
        // 선호 블록이 있고 가능하면 우선
        if (pref && Array.from(allowed).some(code => getShiftBlock(code) === pref)) {
          bestStaff = staff
          bestBlock = pref
          break
        }

        // 선호가 없으면 가능한 블록 중 최근 배정이 적은 블록 선택
        if (!bestStaff) {
          const blocks: ShiftBlock[] = []
          for (const code of allowed) {
            const block = getShiftBlock(code)
            if (block && !blocks.includes(block)) blocks.push(block)
          }
          
          if (blocks.length > 0) {
            blocks.sort((a, b) => {
              const countA = getRecentBlockCount(staff.id, a, dateISO, assignmentsByDate)
              const countB = getRecentBlockCount(staff.id, b, dateISO, assignmentsByDate)
              return countA - countB
            })
            bestStaff = staff
            bestBlock = blocks[0]
          }
        }
      }

      if (!bestStaff || !bestBlock) break

      // 시프트 코드 선택
      const allowed = allowedShifts.get(bestStaff.id) ?? new Set()
      const blockCodes = Array.from(allowed).filter(code => getShiftBlock(code) === bestBlock)
      
      let shiftCode: ShiftCode | null = null
      const halfRequest = req.halfStaff.find(h => h.staffId === bestStaff.id)
      if (halfRequest) {
        shiftCode = blockCodes.find(code => code.endsWith('_H')) ?? null
      } else {
        shiftCode = blockCodes.find(code => code.endsWith('_F')) ?? blockCodes[0] ?? null
      }

      if (!shiftCode) break

      assigned.add(bestStaff.id)
      dailyAssignments.set(bestStaff.id, shiftCode)
    }

    // byShift 구조로 변환 (기존 인터페이스 호환)
    const byShift: Record<Shift, Array<{ staffId: string; unit: 1 | 0.5 }>> = {
      open: [],
      middle: [],
      close: [],
    }

    for (const [staffId, code] of dailyAssignments) {
      const block = getShiftBlock(code)
      if (!block) continue
      const shift = blockToShift(block)
      const unit = code.endsWith('_H') ? 0.5 : 1
      byShift[shift].push({ staffId, unit })
      workload.set(staffId, (workload.get(staffId) ?? 0) + unit)
    }

    const assignment: ScheduleAssignment = { dateISO, byShift }
    assignments.push(assignment)
    assignmentsByDate.set(dateISO, assignment)
  }

  const stats: ScheduleStats[] = input.staff.map((s) => {
    let offDays = 0
    let halfDays = 0
    let fullDays = 0
    for (const a of assignments) {
      const req = reqByDate.get(a.dateISO)
      if (req?.offStaffIds.includes(s.id)) {
        offDays++
        continue
      }
      const units =
        a.byShift.open.filter((x) => x.staffId === s.id).reduce((sum, x) => sum + x.unit, 0) +
        a.byShift.middle.filter((x) => x.staffId === s.id).reduce((sum, x) => sum + x.unit, 0) +
        a.byShift.close.filter((x) => x.staffId === s.id).reduce((sum, x) => sum + x.unit, 0)
      if (units === 0.5) halfDays++
      else if (units >= 1) fullDays++
    }
    const workUnits = (workload.get(s.id) ?? 0) as number
    return { staffId: s.id, name: nameById.get(s.id) ?? s.name, offDays, halfDays, fullDays, workUnits }
  })

  return { assignments, stats }
}

export function validateGeneratedSchedule(input: ScheduleInputs, assignments: ScheduleAssignment[]): string[] {
  const errs: string[] = []
  const reqByDate = new Map(input.requests.map((r) => [r.dateISO, r]))
  
  for (const a of assignments) {
    const req = reqByDate.get(a.dateISO)
    const minBase = Math.round(input.workRules.DAILY_STAFF_BASE)
    const maxBase = Math.round(input.workRules.DAILY_STAFF_MAX)

    // 배정된 인원 수 확인
    const assignedCount = new Set([
      ...a.byShift.open.map(x => x.staffId),
      ...a.byShift.middle.map(x => x.staffId),
      ...a.byShift.close.map(x => x.staffId),
    ]).size

    if (assignedCount < minBase) {
      errs.push(`${a.dateISO}: 배정 인원(${assignedCount}명) < 최소 필요 인원(${minBase}명)`)
    }
    if (assignedCount > maxBase) {
      errs.push(`${a.dateISO}: 배정 인원(${assignedCount}명) > 최대 허용 인원(${maxBase}명)`)
    }

    // 오픈/마감 최소 1명 확인
    const hasOpen = a.byShift.open.length > 0
    const hasClose = a.byShift.close.length > 0
    if (!hasOpen || !hasClose) {
      errs.push(`${a.dateISO}: 오픈 또는 마감 배정이 없습니다`)
    }

    // 날짜별 가용 인원과 목표치 계산(생성 로직과 동일한 방식)
    const reqObj = req ?? { dateISO: a.dateISO, offStaffIds: [], halfStaff: [], needDelta: 0 }
    const availableCount = input.staff.filter(s => !reqObj.offStaffIds.includes(s.id)).length
    const targetHeadcount = Math.min(maxBase, availableCount)

    // target>=3이면 O/M/C 각각 최소 1명 확인
    if (targetHeadcount >= 3) {
      const hasMiddle = a.byShift.middle.length > 0
      if (!hasOpen || !hasMiddle || !hasClose) {
        errs.push(`${a.dateISO}: 필요 인원(${targetHeadcount}) 기준으로 O/M/C 중 하나가 비어있습니다`)
      }
    }

    // 개인별 가용/요청 확인
    for (const shift of ['open', 'middle', 'close'] as Shift[]) {
      for (const asg of a.byShift[shift]) {
        const staff = input.staff.find((s) => s.id === asg.staffId)
        if (!staff) {
          errs.push(`${a.dateISO}: 존재하지 않는 직원 배정`)
        } else {
          if (!staff.availableShifts.includes(shift)) {
            errs.push(`${a.dateISO}: ${staff.name}는 ${shift} 불가`)
          }
          if (staff.requiredShift && staff.requiredShift !== shift) {
            errs.push(`${a.dateISO}: ${staff.name} 필수시프트 위반`)
          }
        }
        if (req?.offStaffIds.includes(asg.staffId)) {
          errs.push(`${a.dateISO}: 휴무 직원 배정됨`)
        }
      }
    }
  }
  return errs
}

export function toSavedSchedule({
  id,
  editSourceScheduleId,
  input,
  assignments,
  stats,
}: {
  id: string
  editSourceScheduleId?: string
  input: ScheduleInputs
  assignments: ScheduleAssignment[]
  stats: ScheduleStats[]
}): SavedSchedule {
  const now = new Date().toISOString()
  const start = dayjs(input.startDateISO, 'YYYY-MM-DD', true)
  const year = start.isValid() ? start.year() : dayjs().year()
  const month = start.isValid() ? start.month() + 1 : dayjs().month() + 1
  return {
    id,
    startDateISO: input.startDateISO,
    endDateISO: input.endDateISO,
    year,
    month,
    createdAtISO: now,
    updatedAtISO: now,
    workRules: input.workRules,
    staff: input.staff,
    requests: input.requests,
    assignments,
    stats,
    editSourceScheduleId,
  }
}

// 근무시간 계산 (시프트 코드 기반)
export function calculateWorkHours(shift: Shift, unit: 0.5 | 1): number {
  const block = shiftToBlock(shift)
  if (unit === 0.5) {
    // 하프: _H
    const code: ShiftCode = `${block}_H`
    return SHIFT_HOURS[code]
  } else {
    // 풀: _F
    const code: ShiftCode = `${block}_F`
    return SHIFT_HOURS[code]
  }
}

// 스케줄 기간 내 직원별 총 근무시간 계산
export function calculateTotalWorkHours(
  schedule: SavedSchedule,
  extraWorkHours?: Map<string, number> // staffId -> 추가근무 시간 합계
): Map<string, number> {
  const totalHours = new Map<string, number>()
  
  // 기본 스케줄 시간
  for (const assignment of schedule.assignments) {
    for (const shift of ['open', 'middle', 'close'] as Shift[]) {
      for (const asg of assignment.byShift[shift]) {
        const hours = calculateWorkHours(shift, asg.unit)
        totalHours.set(asg.staffId, (totalHours.get(asg.staffId) ?? 0) + hours)
      }
    }
  }
  
  // 추가근무 시간
  if (extraWorkHours) {
    for (const [staffId, hours] of extraWorkHours) {
      totalHours.set(staffId, (totalHours.get(staffId) ?? 0) + hours)
    }
  }
  
  return totalHours
}



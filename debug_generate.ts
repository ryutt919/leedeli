import { generateSchedule } from './src/domain/scheduleEngine'
import { WorkRules, StaffMember, DayRequest } from './src/domain/types'

const workRules: WorkRules = {
  DAILY_STAFF_BASE: 2,
  DAILY_STAFF_MAX: 4,
  WORK_HOURS: 8,
  BREAK_HOURS: 1,
}

const staff: StaffMember[] = [
  { id: 'staff-1', name: '오픈장인', availableShifts: ['open', 'middle', 'close'] },
  { id: 'staff-2', name: '마감요정', availableShifts: ['open', 'middle', 'close'] },
  { id: 'staff-3', name: '미들맨', availableShifts: ['open', 'middle', 'close'] },
  { id: 'staff-4', name: '알바생', availableShifts: ['open', 'middle', 'close'] },
] as any[]

const requests: DayRequest[] = [
  { dateISO: '2026-05-01', offStaffIds: [], halfStaff: [], needDelta: 0 },  // 2명 예상
  { dateISO: '2026-05-02', offStaffIds: [], halfStaff: [], needDelta: 1 },  // 3명 예상 (+1)
  { dateISO: '2026-05-03', offStaffIds: [], halfStaff: [], needDelta: -1 }, // 1명 예상 (-1)
]

try {
  console.log('=== 스케줄 생성 시작 (동적 인원 로직 적용) ===')
  const result = generateSchedule({
    startDateISO: '2026-05-01',
    endDateISO: '2026-05-03',
    workRules,
    staff,
    requests,
  })

  result.assignments.forEach(asg => {
    const total = Object.values(asg.byShift).flat().length
    console.log(`\n날짜: ${asg.dateISO}`)
    console.log(`- 목표 인원 변동(delta): ${requests.find(r => r.dateISO === asg.dateISO)?.needDelta}`)
    console.log(`- 실제 배정 인원: ${total}명`)
    console.log(`- 상세 배정:`, JSON.stringify(asg.byShift, null, 2))
  })

  console.log('\n=== 통계 ===')
  result.stats.forEach(s => {
    console.log(`${s.name}: 총 ${s.workUnits} 유닛 근무`)
  })

} catch (e: any) {
  console.error('실행 중 오류 발생:', e.message)
}

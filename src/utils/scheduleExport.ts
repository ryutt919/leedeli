import type { SavedSchedule, Shift } from '../domain/types'
import { downloadXlsx } from './xlsxExport'
import { getExtraWorksByScheduleAndDate } from '../storage/extraWorkRepo'

const SHIFT_LABEL: Record<Shift, string> = { open: '오픈', middle: '미들', close: '마감' }

export function exportScheduleXlsx(s: SavedSchedule) {
  const rows = s.assignments.map((a) => ({
    날짜: a.dateISO,
    오픈: a.byShift.open.map((x) => x.staffId).join(' / '),
    미들: a.byShift.middle.map((x) => x.staffId).join(' / '),
    마감: a.byShift.close.map((x) => x.staffId).join(' / '),
  }))

  const idToName = new Map(s.staff.map((x) => [x.id, x.name]))
  const rows2 = s.assignments.map((a) => {
    const extraWorks = getExtraWorksByScheduleAndDate(s.id, a.dateISO)

    const formatName = (staffId: string, unit: number) => {
      const nm = idToName.get(staffId) ?? staffId
      return unit === 0.5 ? `${nm}H` : nm
    }

    const extraHours = extraWorks.length
      ? extraWorks.map((w) => `${idToName.get(w.staffId) ?? w.staffId}: ${w.hours}h`).join(' / ')
      : ''

    const extraNotes = extraWorks.length
      ? extraWorks.map((w) => `${idToName.get(w.staffId) ?? w.staffId}: ${w.note ?? ''}`).join(' / ')
      : ''

    return {
      날짜: a.dateISO,
      오픈: a.byShift.open.map((x) => formatName(x.staffId, x.unit)).join(' / '),
      미들: a.byShift.middle.map((x) => formatName(x.staffId, x.unit)).join(' / '),
      마감: a.byShift.close.map((x) => formatName(x.staffId, x.unit)).join(' / '),
      '추가근무': extraHours,
      '메모': extraNotes,
    }
  })

  const statsRows = s.stats.map((st) => ({
    이름: st.name,
    근무환산: st.workUnits,
    풀근무: st.fullDays,
    하프: st.halfDays,
    휴무: st.offDays,
  }))

  // xlsxExport는 단일 시트만 지원하므로, 가장 중요한 형태(이름 포함)를 우선 제공
  const name = `${s.startDateISO}~${s.endDateISO}_schedule.xlsx`
  downloadXlsx(name, 'Schedule', rows2)
  // 필요하면 추후 다중 시트로 확장
  void SHIFT_LABEL
  void rows
  void statsRows
}



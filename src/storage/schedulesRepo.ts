import type { SavedSchedule, ScheduleV3 } from '../domain/types'
import dayjs from 'dayjs'
import { readJson, writeJson } from './jsonStore'
import { LS_KEYS } from './keys'
import { daysInMonthISO } from '../utils/date'
import { supabase } from '../utils/supabase'

type Store = {
  items: SavedSchedule[]
}

const EMPTY: Store = { items: [] }

export function loadSchedules(): SavedSchedule[] {
  const r = readJson<Store>(LS_KEYS.schedules)
  if (!r.ok) return EMPTY.items
  const items = Array.isArray(r.value.items) ? r.value.items : EMPTY.items
  // 하위 호환: 구버전(연/월만 저장) → start/end 기간으로 마이그레이션
  return items.map((s) => {
    const any = s as unknown as Partial<SavedSchedule> & { year?: number; month?: number }
    if (any.startDateISO && any.endDateISO) return s
    const year = typeof any.year === 'number' ? any.year : dayjs().year()
    const month = typeof any.month === 'number' ? any.month : dayjs().month() + 1
    const startDateISO = `${year}-${String(month).padStart(2, '0')}-01`
    const endDateISO = daysInMonthISO(year, month).at(-1) ?? dayjs(startDateISO).endOf('month').format('YYYY-MM-DD')
    return { ...(s as any), startDateISO, endDateISO, year, month } as SavedSchedule
  })
}

export function saveSchedules(items: SavedSchedule[]) {
  writeJson<Store>(LS_KEYS.schedules, { items })
}

export function upsertSchedule(next: SavedSchedule) {
  const items = loadSchedules()
  const idx = items.findIndex((x) => x.id === next.id)
  if (idx >= 0) items[idx] = next
  else items.unshift(next)
  saveSchedules(items)
}

export function deleteSchedule(id: string) {
  saveSchedules(loadSchedules().filter((x) => x.id !== id))
}

export function getSchedule(id: string) {
  return loadSchedules().find((x) => x.id === id)
}

// ─── V3: Supabase 기반 ────────────────────────────────────────────

type DbRow = { id: string; data: ScheduleV3 }

export async function loadSchedulesV3(): Promise<ScheduleV3[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('id, data')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[schedulesRepo] loadSchedulesV3', error)
    return []
  }
  return (data ?? [])
    .map((row: DbRow) => {
      const s = { ...(row.data as ScheduleV3), id: row.id }
      // V3 식별: entries 필드 존재 여부
      if (!s.entries || !s.startDateISO) return null
      return s
    })
    .filter((s): s is ScheduleV3 => s !== null)
}

export async function upsertScheduleV3(next: ScheduleV3): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .upsert({ id: next.id, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[schedulesRepo] upsertScheduleV3', error)
    throw error
  }
}

export async function deleteScheduleV3(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) {
    console.error('[schedulesRepo] deleteScheduleV3', error)
    throw error
  }
}

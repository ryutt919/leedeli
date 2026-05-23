import type { ShiftType } from '../domain/types'
import { supabase } from '../utils/supabase'

type DbRow = { id: string; data: ShiftType }

export async function loadShiftTypes(): Promise<ShiftType[]> {
  const { data, error } = await supabase.from('shift_types').select('id, data').order('updated_at')
  if (error) {
    console.error('[shiftTypesRepo] loadShiftTypes', error)
    return []
  }
  return (data ?? []).map((row: DbRow) => ({ ...(row.data as ShiftType), id: row.id }))
}

export async function upsertShiftType(next: ShiftType): Promise<void> {
  const { error } = await supabase
    .from('shift_types')
    .upsert({ id: next.id, name: next.name, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[shiftTypesRepo] upsertShiftType', error)
    throw error
  }
}

export async function deleteShiftType(id: string): Promise<void> {
  const { error } = await supabase.from('shift_types').delete().eq('id', id)
  if (error) {
    console.error('[shiftTypesRepo] deleteShiftType', error)
    throw error
  }
}

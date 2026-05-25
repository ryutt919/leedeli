import type { WeekPreset } from '../domain/types'
import { supabase } from '../utils/supabase'

type DbRow = { id: string; data: WeekPreset }

export async function loadWeekPresets(): Promise<WeekPreset[]> {
  const { data, error } = await supabase.from('week_presets').select('id, data').order('updated_at')
  if (error) {
    console.error('[weekPresetsRepo] loadWeekPresets', error)
    return []
  }
  return (data ?? []).map((row: DbRow) => ({ ...(row.data as WeekPreset), id: row.id }))
}

export async function upsertWeekPreset(next: WeekPreset): Promise<void> {
  const { error } = await supabase
    .from('week_presets')
    .upsert({ id: next.id, name: next.name, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[weekPresetsRepo] upsertWeekPreset', error)
    throw error
  }
}

export async function deleteWeekPreset(id: string): Promise<void> {
  const { error } = await supabase.from('week_presets').delete().eq('id', id)
  if (error) {
    console.error('[weekPresetsRepo] deleteWeekPreset', error)
    throw error
  }
}

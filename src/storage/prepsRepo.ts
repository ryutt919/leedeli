import type { Prep } from '../domain/types'
import { supabase } from '../utils/supabase'

export async function loadPreps(): Promise<Prep[]> {
  const { data, error } = await supabase.from('preps').select('id, data')
  if (error) {
    console.error('[prepsRepo] loadPreps', error)
    return []
  }
  return (data ?? []).map((row) => ({ ...(row.data as Prep), id: row.id }))
}

export async function upsertPrep(next: Prep): Promise<void> {
  const { error } = await supabase
    .from('preps')
    .upsert({ id: next.id, name: next.name, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[prepsRepo] upsertPrep', error)
    throw error
  }
}

export async function deletePrep(id: string): Promise<void> {
  const { error } = await supabase.from('preps').delete().eq('id', id)
  if (error) {
    console.error('[prepsRepo] deletePrep', error)
    throw error
  }
}

export async function savePreps(items: Prep[]): Promise<void> {
  if (items.length === 0) return
  const rows = items.map((p) => ({ id: p.id, name: p.name, data: p }))
  const { error } = await supabase.from('preps').upsert(rows, { onConflict: 'id' })
  if (error) {
    console.error('[prepsRepo] savePreps', error)
    throw error
  }
}

export async function clearPreps(): Promise<void> {
  const { error } = await supabase.from('preps').delete().neq('id', '')
  if (error) {
    console.error('[prepsRepo] clearPreps', error)
    throw error
  }
}

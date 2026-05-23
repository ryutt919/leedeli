import type { MenuItem } from '../domain/types'
import { supabase } from '../utils/supabase'

export async function loadMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase.from('menu_items').select('id, data')
  if (error) {
    console.error('[menuItemsRepo] loadMenuItems', error)
    return []
  }
  return (data ?? []).map((row) => ({ ...(row.data as MenuItem), id: row.id }))
}

export async function upsertMenuItem(next: MenuItem): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .upsert({ id: next.id, name: next.name, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[menuItemsRepo] upsertMenuItem', error)
    throw error
  }
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) {
    console.error('[menuItemsRepo] deleteMenuItem', error)
    throw error
  }
}

export async function saveMenuItems(items: MenuItem[]): Promise<void> {
  if (items.length === 0) return
  const rows = items.map((m) => ({ id: m.id, name: m.name, data: m }))
  const { error } = await supabase.from('menu_items').upsert(rows, { onConflict: 'id' })
  if (error) {
    console.error('[menuItemsRepo] saveMenuItems', error)
    throw error
  }
}

export async function clearMenuItems(): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().neq('id', '')
  if (error) {
    console.error('[menuItemsRepo] clearMenuItems', error)
    throw error
  }
}

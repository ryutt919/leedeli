import { supabase } from '../utils/supabase'
import type { MenuRestockRecord } from '../domain/types'

export async function loadMenuRestockHistory(menuId: string): Promise<MenuRestockRecord[]> {
  const { data, error } = await supabase
    .from('menu_restock_records')
    .select('*')
    .eq('menu_id', menuId)
    .order('restock_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as MenuRestockRecord[]
}

export async function addMenuRestockRecord(menuId: string, date: string, memo?: string): Promise<MenuRestockRecord> {
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = (user?.user_metadata?.name as string) || user?.email || '알 수 없음'
  const row: Record<string, unknown> = { menu_id: menuId, user_email: displayName, restock_date: date }
  if (memo) row.memo = memo
  const { data, error } = await supabase
    .from('menu_restock_records')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as MenuRestockRecord
}

export async function deleteMenuRestockRecord(menuId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('menu_restock_records')
    .delete()
    .eq('menu_id', menuId)
    .eq('restock_date', date)
  if (error) throw error
}

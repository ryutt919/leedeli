import type { Employee } from '../domain/types'
import { supabase } from '../utils/supabase'

type DbRow = { id: string; data: Employee }

export async function loadEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('id, data').order('updated_at')
  if (error) {
    console.error('[employeesRepo] loadEmployees', error)
    return []
  }
  return (data ?? []).map((row: DbRow) => ({ ...(row.data as Employee), id: row.id }))
}

export async function upsertEmployee(next: Employee): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .upsert({ id: next.id, name: next.name, data: next }, { onConflict: 'id' })
  if (error) {
    console.error('[employeesRepo] upsertEmployee', error)
    throw error
  }
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) {
    console.error('[employeesRepo] deleteEmployee', error)
    throw error
  }
}

import { supabase } from '../utils/supabase'
import type { VacationRecord } from '../domain/types'

export async function getVacations(employeeId?: string): Promise<VacationRecord[]> {
  let query = supabase
    .from('vacation_records')
    .select('*')
    .order('date', { ascending: false })
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as VacationRecord[]
}

export async function addVacation(
  record: Omit<VacationRecord, 'id' | 'created_at'>
): Promise<VacationRecord> {
  const { data, error } = await supabase
    .from('vacation_records')
    .insert(record)
    .select()
    .single()
  if (error) throw error
  return data as VacationRecord
}

export async function deleteVacation(id: string): Promise<void> {
  const { error } = await supabase
    .from('vacation_records')
    .delete()
    .eq('id', id)
  if (error) throw error
}

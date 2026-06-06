import { supabase } from '../utils/supabase'
import type { LeaveGrant } from '../domain/types'

export async function loadLeaveGrants(employeeId?: string): Promise<LeaveGrant[]> {
  let query = supabase
    .from('leave_grants')
    .select('*')
    .order('grant_month', { ascending: false })
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeaveGrant[]
}

export async function addLeaveGrant(
  employeeId: string,
  amount: number,
  grantMonth: string,
  note?: string,
  leaveType?: string
): Promise<LeaveGrant> {
  const { data, error } = await supabase
    .from('leave_grants')
    .insert({ employee_id: employeeId, amount, grant_month: grantMonth, note: note ?? null, leave_type: leaveType ?? null })
    .select()
    .single()
  if (error) throw error
  return data as LeaveGrant
}

export async function deleteLeaveGrant(id: string): Promise<void> {
  const { error } = await supabase.from('leave_grants').delete().eq('id', id)
  if (error) throw error
}

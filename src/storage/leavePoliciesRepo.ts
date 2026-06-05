import { supabase } from '../utils/supabase'
import type { LeavePolicy } from '../domain/types'

export async function loadLeavePolicies(): Promise<LeavePolicy[]> {
  const { data, error } = await supabase
    .from('leave_policies')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as LeavePolicy[]
}

export async function upsertLeavePolicy(
  policy: Omit<LeavePolicy, 'id' | 'created_at'> & { id?: string }
): Promise<LeavePolicy> {
  const { data, error } = await supabase
    .from('leave_policies')
    .upsert(policy, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as LeavePolicy
}

export async function deleteLeavePolicy(id: string): Promise<void> {
  const { error } = await supabase.from('leave_policies').delete().eq('id', id)
  if (error) throw error
}

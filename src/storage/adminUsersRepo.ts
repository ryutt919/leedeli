import { supabase } from '../utils/supabase'

export type AdminUser = {
  id: string
  user_id: string
  email: string | null
  granted_by: string | null
  granted_at: string
  revoked_at: string | null
}

export type AllUser = {
  id: string
  email: string | null
  created_at: string
  is_admin: boolean
}

export async function listAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('get_admin_users_with_email')
  if (error) {
    console.error('listAdmins error:', error)
    throw error
  }
  return (data as unknown as AdminUser[]) ?? []
}

export async function grantAdmin(userId: string, grantedBy: string): Promise<void> {
  const { error } = await supabase
    .from('admin_users')
    .insert({ user_id: userId, granted_by: grantedBy })
  if (error) {
    console.error('grantAdmin error:', error)
    throw error
  }
}

export async function revokeAdmin(userId: string): Promise<void> {
  const { error } = await supabase
    .from('admin_users')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (error) {
    console.error('revokeAdmin error:', error)
    throw error
  }
}

export async function getAllUsers(): Promise<AllUser[]> {
  const { data, error } = await supabase.rpc('get_all_users_for_admin')
  if (error) {
    console.error('getAllUsers error:', error)
    throw error
  }
  return (data as unknown as AllUser[]) ?? []
}

export type ActiveAdmin = {
  id: string
  user_id: string
  granted_at: string
  granted_by: string | null
  revoked_at: string | null
}

export async function getActiveAdmins(): Promise<ActiveAdmin[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, user_id, granted_at, granted_by, revoked_at')
    .is('revoked_at', null)
  if (error) {
    console.error('getActiveAdmins error:', error)
    throw error
  }
  return (data as unknown as ActiveAdmin[]) ?? []
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_id_by_email', { p_email: email })
  if (error) {
    console.error('getUserIdByEmail error:', error)
    throw error
  }
  const result: unknown = data
  if (typeof result === 'string') return result
  return null
}

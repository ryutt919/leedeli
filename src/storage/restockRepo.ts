import { supabase } from '../utils/supabase'
import type { RestockRecord } from '../domain/types'

/**
 * Supabase restock_history 테이블과 통신하는 유틸리티 함수 모음
 * - 보충 이력 조회, 추가, 삭제
 * - 현재 로그인한 사용자의 이메일을 자동으로 기록
 */

// 특정 프렙의 보충 이력을 모두 가져오기
export async function loadRestockHistory(prepId: string): Promise<RestockRecord[]> {
    const { data, error } = await supabase
        .from('restock_history')
        .select('*')
        .eq('prep_id', prepId)
        .order('restock_date', { ascending: true })

    if (error) throw error
    return (data ?? []) as RestockRecord[]
}

// 모든 프렙의 보충 이력을 한 번에 가져오기
export async function loadAllRestockHistory(): Promise<RestockRecord[]> {
    const { data, error } = await supabase
        .from('restock_history')
        .select('*')
        .order('restock_date', { ascending: true })

    if (error) throw error
    return (data ?? []) as RestockRecord[]
}

// 보충 이력 추가 (현재 로그인한 사용자의 이름을 기록, 이름 없으면 이메일 fallback)
export async function addRestockRecord(prepId: string, date: string): Promise<RestockRecord> {
    const { data: { user } } = await supabase.auth.getUser()
    // user_metadata.name (회원가입 시 입력한 이름)을 우선 사용
    const displayName = (user?.user_metadata?.name as string) || user?.email || '알 수 없음'

    const { data, error } = await supabase
        .from('restock_history')
        .insert({ prep_id: prepId, user_email: displayName, restock_date: date })
        .select()
        .single()

    if (error) throw error
    return data as RestockRecord
}

// 특정 프렙의 특정 날짜 보충 이력 삭제
export async function deleteRestockRecord(prepId: string, date: string): Promise<void> {
    const { error } = await supabase
        .from('restock_history')
        .delete()
        .eq('prep_id', prepId)
        .eq('restock_date', date)

    if (error) throw error
}

// 특정 날짜에 보충된 모든 기록 조회
export async function loadRestockByDate(date: string): Promise<RestockRecord[]> {
    const { data, error } = await supabase
        .from('restock_history')
        .select('*')
        .eq('restock_date', date)
        .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as RestockRecord[]
}

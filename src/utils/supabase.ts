import { createClient } from '@supabase/supabase-js'

// 환경 변수에서 Supabase URL과 anon key를 읽어옴
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Supabase 클라이언트 초기화 (세션은 localStorage에 자동 저장 → 새로고침해도 로그인 유지)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

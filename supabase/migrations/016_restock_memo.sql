-- 보충 이력에 메모 컬럼 추가
ALTER TABLE public.restock_history ADD COLUMN IF NOT EXISTS memo TEXT;

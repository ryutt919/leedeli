-- migration 005: preps 테이블 data/created_at 컬럼 추가
-- 문제: prepsRepo.ts가 data jsonb 컬럼을 기대하나 테이블에 없음 → 42703 column does not exist
-- 수정: 컬럼 추가 및 기존 행 backfill

ALTER TABLE public.preps
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 기존 행 backfill: data 컬럼을 name 기반 최소 구조로 채움
UPDATE public.preps
SET data = jsonb_build_object('id', id, 'name', name, 'items', '[]'::jsonb, 'restockDatesISO', '[]'::jsonb)
WHERE data = '{}'::jsonb;

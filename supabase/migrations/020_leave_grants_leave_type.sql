-- 부여 유형 (월차/연차/수동 조정 등)을 직접 기록하기 위한 컬럼
ALTER TABLE leave_grants
  ADD COLUMN IF NOT EXISTS leave_type text;

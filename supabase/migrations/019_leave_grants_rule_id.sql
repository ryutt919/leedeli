-- rule_id 컬럼 추가 (어느 규칙이 발행했는지 추적)
ALTER TABLE leave_grants
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES leave_policies(id) ON DELETE SET NULL;

-- 기존 UNIQUE 제약 제거
ALTER TABLE leave_grants
  DROP CONSTRAINT IF EXISTS leave_grants_employee_id_grant_month_key;

-- 규칙별 중복 방지 (rule_id가 있는 경우만, 수동 조정은 제외)
CREATE UNIQUE INDEX IF NOT EXISTS leave_grants_rule_unique
  ON leave_grants(employee_id, grant_month, rule_id)
  WHERE rule_id IS NOT NULL;

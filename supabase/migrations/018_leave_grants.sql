-- 휴가 부여 이력 (직원별 월차/연차 부여 기록)
CREATE TABLE IF NOT EXISTS leave_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount numeric(4,1) NOT NULL DEFAULT 1,
  grant_month text NOT NULL,   -- 'YYYY-MM' 형식
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, grant_month)
);
ALTER TABLE leave_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"   ON leave_grants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert" ON leave_grants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth delete" ON leave_grants FOR DELETE USING (auth.role() = 'authenticated');

-- 휴가 부여 정책 (앱 전역 규칙 설정)
CREATE TABLE IF NOT EXISTS leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('monthly', 'yearly')),
  amount numeric(4,1) NOT NULL DEFAULT 1,
  trigger_month integer,   -- yearly 전용: 몇 월에 부여 (1~12)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"   ON leave_policies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert" ON leave_policies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update" ON leave_policies FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth delete" ON leave_policies FOR DELETE USING (auth.role() = 'authenticated');

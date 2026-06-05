-- menu_restock_records: 메뉴 아이템별 보충 이력 (restock_history의 메뉴 버전)
CREATE TABLE IF NOT EXISTS menu_restock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id text NOT NULL,
  user_email text NOT NULL,
  restock_date date NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_restock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read"
  ON menu_restock_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth insert"
  ON menu_restock_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth delete"
  ON menu_restock_records FOR DELETE
  USING (auth.role() = 'authenticated');

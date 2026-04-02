#!/usr/bin/env python3
"""
migrate_ls_to_supabase.py — localStorage 데이터 → Supabase 마이그레이션

사용법:
  # 브라우저 콘솔에서 먼저 데이터 추출:
  # JSON.stringify({schedules: localStorage.getItem('leedeli_schedules'), ...})
  # → export.json 저장 후 아래 실행

  python harness/skills/migrate_ls_to_supabase.py --input export.json --dry-run
  python harness/skills/migrate_ls_to_supabase.py --input export.json
"""

import argparse
import json
import os
import sys
from pathlib import Path


def load_export(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse_ls_value(raw: str | None) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="브라우저에서 추출한 export.json 경로")
    parser.add_argument("--dry-run", action="store_true", help="실제 Supabase 삽입 없이 내용만 출력")
    args = parser.parse_args()

    export = load_export(args.input)

    schedules = parse_ls_value(export.get("schedules"))
    ingredients = parse_ls_value(export.get("ingredients"))
    preps = parse_ls_value(export.get("preps"))

    print(f"[migrate] schedules: {len(schedules)}건")
    print(f"[migrate] ingredients: {len(ingredients)}건")
    print(f"[migrate] preps: {len(preps)}건")

    if args.dry_run:
        print("\n[migrate][dry-run] 실제 삽입 없음. 위 건수 확인 후 --dry-run 제거하여 실행.")
        return

    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("[migrate][err] VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
        sys.exit(1)

    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("[migrate][err] supabase-py 필요: pip install supabase")
        sys.exit(1)

    client = create_client(url, key)

    def upsert_table(table: str, items: list, id_key: str = "id") -> None:
        if not items:
            return
        rows = [{"id": item[id_key], "data": item} for item in items if id_key in item]
        result = client.table(table).upsert(rows).execute()
        print(f"[migrate] {table}: {len(rows)}건 삽입 완료")

    upsert_table("schedules", schedules)
    upsert_table("ingredients", ingredients)
    upsert_table("preps", preps)
    print("[migrate] 완료.")


if __name__ == "__main__":
    main()

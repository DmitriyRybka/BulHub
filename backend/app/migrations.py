"""Мини-миграции.

SQLModel.metadata.create_all создаёт только отсутствующие таблицы и не
добавляет новые колонки в уже существующие. Здесь досоздаём их руками —
одинаково для SQLite (dev.db) и Postgres (Supabase).
"""
from sqlalchemy import inspect, text

from .database import engine

# (таблица, колонка, SQL-тип). Колонки только nullable — старые строки не ломаются.
COLUMNS = [
    ("todoitem", "remind_at", "TIMESTAMP"),
    ("todoitem", "completed_at", "TIMESTAMP"),
]


def migrate() -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, column, sql_type in COLUMNS:
            if table not in tables:
                continue  # таблицу только что создал create_all — колонка уже есть
            existing = {c["name"] for c in insp.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))

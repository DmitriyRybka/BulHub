-- Row-Level Security для финансовых таблиц (второй рубеж после проверок в API).
-- Выполни в Supabase SQL Editor ПОСЛЕ первого запуска бэкенда (таблицы уже созданы).
-- Эффект: анонимный/authenticated доступ через Supabase API не увидит эти таблицы вовсе,
-- работать с ними может только бэкенд (сервисная роль).

alter table "transaction" enable row level security;
alter table "budget"      enable row level security;
alter table "category"    enable row level security;
alter table "user"        enable row level security;

-- Политик не создаём => для ролей anon/authenticated доступ полностью закрыт.
-- Бэкенд подключается ролью postgres/service и политики обходит — авторизацию
-- по user_id для него выполняет код приложения (routers/finance.py, deps.py).

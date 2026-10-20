# Буль-Хаб — личный продуктивный хаб

Три модуля: **Календарь** (личные + общие с ролями, повторения, напоминания),
**Финансы** (строго приватные, бюджеты, советы), **Запоминатор** (личные и общие списки дел).

Стек: FastAPI + SQLModel + PostgreSQL (Supabase) · React + TypeScript (Vite) · JWT + argon2.

## Структура

```
hub/
├── backend/
│   ├── requirements.txt
│   ├── .env.example          # скопируй в .env и заполни
│   ├── supabase_rls.sql      # опциональные RLS-политики для Supabase
│   └── app/
│       ├── main.py           # приложение + CORS
│       ├── config.py         # настройки из .env
│       ├── database.py       # подключение к БД
│       ├── models.py         # все таблицы (SQLModel)
│       ├── schemas.py        # схемы запросов/ответов
│       ├── security.py       # argon2 + JWT
│       ├── deps.py           # текущий пользователь + проверка ролей
│       └── routers/
│           ├── auth.py       # /auth: register, login, me
│           ├── calendar.py   # /calendar: пространства, участники, события
│           ├── finance.py    # /finance: категории, операции, бюджеты, сводка
│           └── todos.py      # /todos: списки, участники, задачи
└── frontend/
    ├── package.json, vite.config.ts, tsconfig.json, index.html
    └── src/
        ├── main.tsx, App.tsx (роутер + защита маршрутов)
        ├── styles.css
        ├── api/client.ts     # fetch-обёртка с JWT + типы
        ├── components/Layout.tsx
        └── pages/  Login.tsx · Calendar.tsx · Finance.tsx · Todos.tsx
```

## Запуск с нуля

Нужны: Python 3.11+, Node.js 18+.

### 1. База данных (Supabase)

1. Зарегистрируйся на https://supabase.com, создай проект (регион любой, пароль БД сохрани).
2. Project Settings → Database → Connection string → вкладка **URI**.
   Возьми строку **Session pooler** (порт 5432) — она выглядит как
   `postgresql://postgres.xxxx:[PASSWORD]@aws-0-...pooler.supabase.com:5432/postgres`.
3. Подставь свой пароль вместо `[PASSWORD]`.

> Хочешь без Supabase? Оставь `DATABASE_URL` пустым — бэкенд поднимется на
> локальном SQLite (`dev.db`). Для разработки этого хватает.

### 2. Бэкенд

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # Windows: copy .env.example .env
# открой .env: вставь DATABASE_URL и сгенерируй JWT_SECRET:
python -c "import secrets; print(secrets.token_hex(32))"

uvicorn app.main:app --reload --port 8000
```

Таблицы создадутся автоматически при первом старте.
Проверка: http://localhost:8000/docs — интерактивная документация всех эндпоинтов.

### 3. Фронтенд (второй терминал)

```bash
cd frontend
npm install
npm run dev
```

Открой http://localhost:5173, зарегистрируйся — личный календарь и список
«Мои дела» создадутся автоматически.

## Как устроен доступ

- **JWT**: логин выдаёт токен, фронт шлёт его в `Authorization: Bearer ...`.
  Пароли хранятся только как argon2id-хеши.
- **Изоляция данных** обеспечивается на уровне API: каждый запрос финансов
  жёстко фильтруется по `user_id` из токена; календари и списки проверяются
  через роль (owner / editor / viewer) в `deps.py`. Кросс-пользовательские
  запросы возвращают 403/404 (проверено тестами).
- **Финансы не расшариваются by design** — в API просто нет эндпоинтов
  для выдачи чужих финансовых данных, а все выборки привязаны к токену.
- **RLS в Postgres** (второй рубеж обороны): файл `backend/supabase_rls.sql`
  включает Row-Level Security на таблицах финансов, чтобы даже прямой SQL-доступ
  через Supabase API не раскрывал чужие данные. Выполни его в Supabase
  SQL Editor после первого запуска бэкенда (когда таблицы уже созданы).
  Замечание: сам бэкенд подключается сервисной ролью и политики обходит —
  это нормально, авторизацию для него выполняет код приложения.

## Роли

| Действие | owner | editor | viewer |
|---|---|---|---|
| Смотреть события/задачи | ✓ | ✓ | ✓ |
| Создавать/менять/удалять | ✓ | ✓ | — |
| Приглашать/удалять участников | ✓ | — | — |
| Удалить календарь/список | ✓ | — | — |

## Что доработать дальше (идеи)

- Push-напоминания (сейчас напоминание — поле события, фронт показывает 🔔).
- Alembic-миграции вместо `create_all` при изменении схемы.
- Refresh-токены и httpOnly-cookie вместо localStorage для продакшена.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .migrations import migrate
from .routers import auth, calendar, finance, stats, todos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # создаёт таблицы, если их нет
    migrate()  # досоздаёт новые колонки в уже существующих таблицах
    yield


app = FastAPI(title="Productivity Hub API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+):(5173|8081)",  # 5173 — веб на Vite, 8081 — Expo Web
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calendar.router)
app.include_router(finance.router)
app.include_router(todos.router)
app.include_router(stats.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}

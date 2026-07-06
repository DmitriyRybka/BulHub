from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import auth, calendar, finance, todos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # создаёт таблицы, если их нет
    yield


app = FastAPI(title="Productivity Hub API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calendar.router)
app.include_router(finance.router)
app.include_router(todos.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}

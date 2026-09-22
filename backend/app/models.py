from datetime import datetime, date, timezone
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field, UniqueConstraint


# ---------- Пользователи ----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str
    password_hash: str  # только argon2-хеш, никогда сам пароль
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------- Календарь ----------

class Role(str, Enum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class CalendarSpace(SQLModel, table=True):
    """Календарь-пространство. У каждого пользователя есть личный,
    плюс можно создавать общие."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id", index=True)
    is_personal: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SpaceMember(SQLModel, table=True):
    """Участники общего календаря с ролями."""
    __table_args__ = (UniqueConstraint("space_id", "user_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    space_id: int = Field(foreign_key="calendarspace.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: Role = Role.viewer


class RecurFreq(str, Enum):
    none = "none"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    space_id: int = Field(foreign_key="calendarspace.id", index=True)
    title: str
    description: str = ""
    start: datetime
    end: datetime
    all_day: bool = False
    recur_freq: RecurFreq = RecurFreq.none
    recur_until: Optional[date] = None       # до какой даты повторять
    reminder_minutes: Optional[int] = None   # напоминание за N минут
    created_by: int = Field(foreign_key="user.id")


# ---------- Финансы (строго приватные) ----------

class CategoryKind(str, Enum):
    income = "income"
    expense = "expense"


class Category(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "name", "kind"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    kind: CategoryKind = CategoryKind.expense


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category_id: int = Field(foreign_key="category.id")
    amount: float  # всегда положительное; знак определяется kind категории
    date: date
    note: str = ""


class Budget(SQLModel, table=True):
    """Лимит расходов на категорию на месяц (формат month: '2026-07')."""
    __table_args__ = (UniqueConstraint("user_id", "category_id", "month"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category_id: int = Field(foreign_key="category.id")
    month: str = Field(index=True)
    limit_amount: float


# ---------- Запоминатор ----------

class TodoList(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ListMember(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("list_id", "user_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    list_id: int = Field(foreign_key="todolist.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: Role = Role.editor


class TodoStatus(str, Enum):
    todo = "todo"
    doing = "doing"
    done = "done"


class TodoItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    list_id: int = Field(foreign_key="todolist.id", index=True)
    title: str
    status: TodoStatus = TodoStatus.todo
    due_date: Optional[date] = None
    remind_at: Optional[datetime] = None  # когда напомнить, naive UTC
    completed_at: Optional[datetime] = None  # когда перевели в done, naive UTC
    created_by: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

from datetime import datetime, date, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from .models import Role, RecurFreq, CategoryKind, TodoStatus


# ---------- Auth ----------

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    username: str


# ---------- Календарь ----------

class SpaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SpaceOut(BaseModel):
    id: int
    name: str
    owner_id: int
    is_personal: bool
    my_role: Role


class MemberAdd(BaseModel):
    email: EmailStr
    role: Role = Role.viewer  # owner назначать нельзя — проверяется в роутере


class MemberOut(BaseModel):
    user_id: int
    email: str
    username: str
    role: Role


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    start: datetime
    end: datetime
    all_day: bool = False
    recur_freq: RecurFreq = RecurFreq.none
    recur_until: Optional[date] = None
    reminder_minutes: Optional[int] = Field(default=None, ge=0, le=60 * 24 * 7)


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    all_day: Optional[bool] = None
    recur_freq: Optional[RecurFreq] = None
    recur_until: Optional[date] = None
    reminder_minutes: Optional[int] = None


class EventOut(BaseModel):
    id: int
    space_id: int
    title: str
    description: str
    start: datetime
    end: datetime
    all_day: bool
    recur_freq: RecurFreq
    recur_until: Optional[date]
    reminder_minutes: Optional[int]
    created_by: int


class OccurrenceOut(BaseModel):
    """Конкретное вхождение события (с учётом повторений)."""
    event_id: int
    title: str
    start: datetime
    end: datetime
    all_day: bool
    space_id: int
    reminder_minutes: Optional[int]


# ---------- Финансы ----------

class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: CategoryKind = CategoryKind.expense


class CategoryOut(BaseModel):
    id: int
    name: str
    kind: CategoryKind


class TransactionCreate(BaseModel):
    category_id: int
    amount: float = Field(gt=0)
    date: date
    note: str = ""


class TransactionOut(BaseModel):
    id: int
    category_id: int
    amount: float
    date: date
    note: str


class BudgetSet(BaseModel):
    category_id: int
    month: str = Field(pattern=r"^\d{4}-\d{2}$")  # '2026-07'
    limit_amount: float = Field(gt=0)


class BudgetOut(BaseModel):
    id: int
    category_id: int
    month: str
    limit_amount: float


class CategorySummary(BaseModel):
    category_id: int
    name: str
    kind: CategoryKind
    total: float
    budget_limit: Optional[float] = None
    budget_left: Optional[float] = None


class MonthSummary(BaseModel):
    month: str
    income_total: float
    expense_total: float
    savings: float
    savings_rate: float  # доля от дохода, 0..1
    by_category: list[CategorySummary]
    advice: list[str]


# ---------- Запоминатор ----------

class TodoListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class TodoListOut(BaseModel):
    id: int
    name: str
    owner_id: int
    my_role: Role


def _naive_utc(v: Optional[datetime]) -> Optional[datetime]:
    """Фронт шлёт ISO с 'Z', а в БД время хранится без пояса — как у событий."""
    if v is not None and v.tzinfo is not None:
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
    return v


class TodoItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_date: Optional[date] = None
    remind_at: Optional[datetime] = None

    _remind_utc = field_validator("remind_at")(_naive_utc)


class TodoItemUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[TodoStatus] = None
    due_date: Optional[date] = None
    remind_at: Optional[datetime] = None

    _remind_utc = field_validator("remind_at")(_naive_utc)


class TodoItemOut(BaseModel):
    id: int
    list_id: int
    title: str
    status: TodoStatus
    due_date: Optional[date]
    remind_at: Optional[datetime] = None
    created_by: int


# ---------- Статистика ----------

class MonthStat(BaseModel):
    month: str        # "2026-09"
    done: int
    created: int


class TaskStats(BaseModel):
    total: int
    done: int
    active: int       # не выполненные: todo + doing
    doing: int
    overdue: int      # активные с дедлайном в прошлом
    done_this_month: int
    avg_done_per_month: float
    best_month: Optional[MonthStat]
    by_month: list[MonthStat]  # последние 6 месяцев, от старого к новому


class EventStats(BaseModel):
    total: int
    this_month: int


class StatsOut(BaseModel):
    member_since: date
    tasks: TaskStats
    events: EventStats

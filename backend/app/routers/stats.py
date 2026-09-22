from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, col, select

from ..database import get_session
from ..deps import get_current_user
from ..models import (
    CalendarSpace, Event, ListMember, SpaceMember, TodoItem, TodoList, TodoStatus, User,
)
from ..schemas import EventStats, MonthStat, StatsOut, TaskStats

router = APIRouter(prefix="/stats", tags=["stats"])


def _month(dt) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


@router.get("", response_model=StatsOut)
def my_stats(
    # смещение как у JS getTimezoneOffset(): UTC − местное, в минутах (Москва = -180)
    tz: int = Query(0, ge=-14 * 60, le=14 * 60),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Сводка по всем спискам и календарям, к которым у пользователя есть доступ."""
    shift = timedelta(minutes=-tz)

    def local(dt: datetime) -> datetime:
        return dt + shift  # в БД naive UTC

    today = local(datetime.now(timezone.utc).replace(tzinfo=None)).date()
    this_month = _month(today)

    # ---- задачи ----
    list_ids = set(session.exec(select(TodoList.id).where(TodoList.owner_id == user.id)).all())
    list_ids |= set(session.exec(select(ListMember.list_id).where(ListMember.user_id == user.id)).all())
    items = (
        session.exec(select(TodoItem).where(col(TodoItem.list_id).in_(list_ids))).all()
        if list_ids else []
    )

    done = [i for i in items if i.status == TodoStatus.done]
    active = [i for i in items if i.status != TodoStatus.done]

    # У задач, выполненных до появления completed_at, момента выполнения нет —
    # берём дату создания, иначе они выпали бы из помесячной статистики.
    done_by_month = Counter(_month(local(i.completed_at or i.created_at)) for i in done)
    created_by_month = Counter(_month(local(i.created_at)) for i in items)

    start = local(user.created_at).date()
    months_active = (today.year - start.year) * 12 + (today.month - start.month) + 1

    last6: list[MonthStat] = []
    y, m = today.year, today.month
    for _ in range(6):
        key = f"{y:04d}-{m:02d}"
        last6.append(MonthStat(month=key, done=done_by_month[key], created=created_by_month[key]))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    last6.reverse()

    best = None
    if done_by_month:
        key, count = max(done_by_month.items(), key=lambda kv: (kv[1], kv[0]))
        best = MonthStat(month=key, done=count, created=created_by_month[key])

    tasks = TaskStats(
        total=len(items),
        done=len(done),
        active=len(active),
        doing=sum(1 for i in active if i.status == TodoStatus.doing),
        overdue=sum(1 for i in active if i.due_date and i.due_date < today),
        done_this_month=done_by_month[this_month],
        avg_done_per_month=round(len(done) / max(months_active, 1), 1),
        best_month=best,
        by_month=last6,
    )

    # ---- календарь ----
    space_ids = set(session.exec(select(CalendarSpace.id).where(CalendarSpace.owner_id == user.id)).all())
    space_ids |= set(session.exec(select(SpaceMember.space_id).where(SpaceMember.user_id == user.id)).all())
    events = (
        session.exec(select(Event).where(col(Event.space_id).in_(space_ids))).all()
        if space_ids else []
    )
    # повторяющееся событие считаем один раз — это «сколько событий заведено»
    event_stats = EventStats(
        total=len(events),
        this_month=sum(1 for e in events if _month(local(e.start)) == this_month),
    )

    return StatsOut(member_since=start, tasks=tasks, events=event_stats)

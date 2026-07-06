from datetime import datetime, timedelta, date, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user, get_space_role, require_space_role
from ..models import (
    User, CalendarSpace, SpaceMember, Event, Role, RecurFreq,
)
from ..schemas import (
    SpaceCreate, SpaceOut, MemberAdd, MemberOut,
    EventCreate, EventUpdate, EventOut, OccurrenceOut,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])

def _naive_utc(dt: datetime) -> datetime:
    """Приводит любую datetime к naive UTC — фронт шлёт ISO с 'Z',
    а в БД (timestamp without time zone) даты хранятся без пояса."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt




# ---------- Пространства ----------

@router.get("/spaces", response_model=list[SpaceOut])
def my_spaces(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    own = session.exec(select(CalendarSpace).where(CalendarSpace.owner_id == user.id)).all()
    memberships = session.exec(select(SpaceMember).where(SpaceMember.user_id == user.id)).all()
    result = [
        SpaceOut(id=s.id, name=s.name, owner_id=s.owner_id,
                 is_personal=s.is_personal, my_role=Role.owner)
        for s in own
    ]
    for m in memberships:
        s = session.get(CalendarSpace, m.space_id)
        if s:
            result.append(SpaceOut(id=s.id, name=s.name, owner_id=s.owner_id,
                                   is_personal=s.is_personal, my_role=m.role))
    return result


@router.post("/spaces", response_model=SpaceOut, status_code=201)
def create_space(data: SpaceCreate, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    space = CalendarSpace(name=data.name, owner_id=user.id, is_personal=False)
    session.add(space)
    session.commit()
    session.refresh(space)
    return SpaceOut(id=space.id, name=space.name, owner_id=space.owner_id,
                    is_personal=False, my_role=Role.owner)


@router.delete("/spaces/{space_id}", status_code=204)
def delete_space(space_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    require_space_role(session, user, space_id, Role.owner)
    space = session.get(CalendarSpace, space_id)
    if space.is_personal:
        raise HTTPException(400, "Личный календарь удалить нельзя")
    for e in session.exec(select(Event).where(Event.space_id == space_id)).all():
        session.delete(e)
    for m in session.exec(select(SpaceMember).where(SpaceMember.space_id == space_id)).all():
        session.delete(m)
    session.delete(space)
    session.commit()


# ---------- Участники ----------

@router.get("/spaces/{space_id}/members", response_model=list[MemberOut])
def list_members(space_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    get_space_role(session, user, space_id)  # любой участник может смотреть состав
    space = session.get(CalendarSpace, space_id)
    owner = session.get(User, space.owner_id)
    result = [MemberOut(user_id=owner.id, email=owner.email,
                        username=owner.username, role=Role.owner)]
    for m in session.exec(select(SpaceMember).where(SpaceMember.space_id == space_id)).all():
        u = session.get(User, m.user_id)
        if u:
            result.append(MemberOut(user_id=u.id, email=u.email,
                                    username=u.username, role=m.role))
    return result


@router.post("/spaces/{space_id}/members", response_model=MemberOut, status_code=201)
def add_member(space_id: int, data: MemberAdd, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    require_space_role(session, user, space_id, Role.owner)
    space = session.get(CalendarSpace, space_id)
    if space.is_personal:
        raise HTTPException(400, "Личный календарь не расшаривается — создай общий")
    if data.role == Role.owner:
        raise HTTPException(400, "Роль owner назначить нельзя")
    target = session.exec(select(User).where(User.email == data.email)).first()
    if target is None:
        raise HTTPException(404, "Пользователь с таким email не найден")
    if target.id == space.owner_id:
        raise HTTPException(400, "Владелец уже имеет полный доступ")
    exists = session.exec(select(SpaceMember).where(
        SpaceMember.space_id == space_id, SpaceMember.user_id == target.id)).first()
    if exists:
        exists.role = data.role
        session.add(exists)
    else:
        session.add(SpaceMember(space_id=space_id, user_id=target.id, role=data.role))
    session.commit()
    return MemberOut(user_id=target.id, email=target.email,
                     username=target.username, role=data.role)


@router.delete("/spaces/{space_id}/members/{member_user_id}", status_code=204)
def remove_member(space_id: int, member_user_id: int,
                  user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    # владелец удаляет кого угодно; участник может выйти сам
    role = get_space_role(session, user, space_id)
    if role != Role.owner and member_user_id != user.id:
        raise HTTPException(403, "Удалять участников может только владелец")
    member = session.exec(select(SpaceMember).where(
        SpaceMember.space_id == space_id, SpaceMember.user_id == member_user_id)).first()
    if member is None:
        raise HTTPException(404, "Участник не найден")
    session.delete(member)
    session.commit()


# ---------- События ----------

@router.post("/spaces/{space_id}/events", response_model=EventOut, status_code=201)
def create_event(space_id: int, data: EventCreate,
                 user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    require_space_role(session, user, space_id, Role.editor)
    data.start = _naive_utc(data.start)
    data.end = _naive_utc(data.end)
    if data.end <= data.start:
        raise HTTPException(400, "Конец события должен быть позже начала")
    event = Event(space_id=space_id, created_by=user.id, **data.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, data: EventUpdate,
                 user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "Событие не найдено")
    require_space_role(session, user, event.space_id, Role.editor)
    for key, value in data.model_dump(exclude_unset=True).items():
        if key in ("start", "end") and value is not None:
            value = _naive_utc(value)
        setattr(event, key, value)
    if event.end <= event.start:
        raise HTTPException(400, "Конец события должен быть позже начала")
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "Событие не найдено")
    require_space_role(session, user, event.space_id, Role.editor)
    session.delete(event)
    session.commit()


def _expand(event: Event, range_start: datetime, range_end: datetime) -> list[OccurrenceOut]:
    """Разворачивает повторяющееся событие в конкретные вхождения в диапазоне."""
    duration = event.end - event.start
    occurrences: list[OccurrenceOut] = []

    def add(start: datetime):
        occurrences.append(OccurrenceOut(
            event_id=event.id, title=event.title, start=start, end=start + duration,
            all_day=event.all_day, space_id=event.space_id,
            reminder_minutes=event.reminder_minutes,
        ))

    if event.recur_freq == RecurFreq.none:
        if event.start < range_end and event.end > range_start:
            add(event.start)
        return occurrences

    limit_date: date = event.recur_until or range_end.date()
    current = event.start
    guard = 0
    while current.date() <= limit_date and current < range_end and guard < 1000:
        if current + duration > range_start:
            add(current)
        if event.recur_freq == RecurFreq.daily:
            current += timedelta(days=1)
        elif event.recur_freq == RecurFreq.weekly:
            current += timedelta(weeks=1)
        else:  # monthly: тот же день следующего месяца (28-е и раньше — безопасно)
            month = current.month + 1
            year = current.year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            day = min(current.day, 28)
            current = current.replace(year=year, month=month, day=day)
        guard += 1
    return occurrences


@router.get("/spaces/{space_id}/occurrences", response_model=list[OccurrenceOut])
def occurrences(space_id: int,
                start: datetime = Query(...), end: datetime = Query(...),
                user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    get_space_role(session, user, space_id)  # viewer и выше
    start = _naive_utc(start)
    end = _naive_utc(end)
    events = session.exec(select(Event).where(Event.space_id == space_id)).all()
    result: list[OccurrenceOut] = []
    for e in events:
        result.extend(_expand(e, start, end))
    result.sort(key=lambda o: o.start)
    return result

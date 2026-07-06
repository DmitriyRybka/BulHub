from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
import jwt

from .database import get_session
from .models import User, CalendarSpace, SpaceMember, Role, TodoList, ListMember
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    session: Session = Depends(get_session),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нет токена авторизации")
    try:
        user_id = decode_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен истёк, войди заново")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный токен")
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")
    return user


# --- проверки доступа (авторизация на уровне приложения) ---

def get_space_role(session: Session, user: User, space_id: int) -> Role:
    """Роль пользователя в календаре или 403/404."""
    space = session.get(CalendarSpace, space_id)
    if space is None:
        raise HTTPException(404, "Календарь не найден")
    if space.owner_id == user.id:
        return Role.owner
    member = session.exec(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == user.id
        )
    ).first()
    if member is None:
        raise HTTPException(403, "Нет доступа к этому календарю")
    return member.role


def require_space_role(session: Session, user: User, space_id: int, minimum: Role) -> Role:
    order = {Role.viewer: 0, Role.editor: 1, Role.owner: 2}
    role = get_space_role(session, user, space_id)
    if order[role] < order[minimum]:
        raise HTTPException(403, f"Нужна роль не ниже «{minimum.value}»")
    return role


def get_list_role(session: Session, user: User, list_id: int) -> Role:
    todo_list = session.get(TodoList, list_id)
    if todo_list is None:
        raise HTTPException(404, "Список не найден")
    if todo_list.owner_id == user.id:
        return Role.owner
    member = session.exec(
        select(ListMember).where(
            ListMember.list_id == list_id, ListMember.user_id == user.id
        )
    ).first()
    if member is None:
        raise HTTPException(403, "Нет доступа к этому списку")
    return member.role

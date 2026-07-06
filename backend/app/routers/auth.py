from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import User, CalendarSpace, TodoList
from ..schemas import RegisterIn, LoginIn, TokenOut, UserOut
from ..security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, session: Session = Depends(get_session)):
    exists = session.exec(select(User).where(User.email == data.email)).first()
    if exists:
        raise HTTPException(409, "Пользователь с таким email уже есть")
    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # автоматически создаём личный календарь и личный список дел
    session.add(CalendarSpace(name="Личный календарь", owner_id=user.id, is_personal=True))
    session.add(TodoList(name="Мои дела", owner_id=user.id))
    session.commit()

    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()
    # одинаковая ошибка для «нет такого email» и «неверный пароль»
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Неверный email или пароль")
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, username=user.username)

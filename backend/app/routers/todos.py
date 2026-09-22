from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user, get_list_role
from ..models import User, TodoList, ListMember, TodoItem, TodoStatus, Role
from ..schemas import (
    TodoListCreate, TodoListOut, MemberAdd, MemberOut,
    TodoItemCreate, TodoItemUpdate, TodoItemOut,
)

router = APIRouter(prefix="/todos", tags=["todos"])


# ---------- Списки ----------

@router.get("/lists", response_model=list[TodoListOut])
def my_lists(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    own = session.exec(select(TodoList).where(TodoList.owner_id == user.id)).all()
    result = [TodoListOut(id=l.id, name=l.name, owner_id=l.owner_id, my_role=Role.owner)
              for l in own]
    for m in session.exec(select(ListMember).where(ListMember.user_id == user.id)).all():
        l = session.get(TodoList, m.list_id)
        if l:
            result.append(TodoListOut(id=l.id, name=l.name, owner_id=l.owner_id, my_role=m.role))
    return result


@router.post("/lists", response_model=TodoListOut, status_code=201)
def create_list(data: TodoListCreate, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    todo_list = TodoList(name=data.name, owner_id=user.id)
    session.add(todo_list)
    session.commit()
    session.refresh(todo_list)
    return TodoListOut(id=todo_list.id, name=todo_list.name,
                       owner_id=user.id, my_role=Role.owner)


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(list_id: int, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    if get_list_role(session, user, list_id) != Role.owner:
        raise HTTPException(403, "Удалять список может только владелец")
    for item in session.exec(select(TodoItem).where(TodoItem.list_id == list_id)).all():
        session.delete(item)
    for m in session.exec(select(ListMember).where(ListMember.list_id == list_id)).all():
        session.delete(m)
    session.delete(session.get(TodoList, list_id))
    session.commit()


# ---------- Участники ----------

@router.post("/lists/{list_id}/members", response_model=MemberOut, status_code=201)
def add_member(list_id: int, data: MemberAdd, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    if get_list_role(session, user, list_id) != Role.owner:
        raise HTTPException(403, "Приглашать может только владелец")
    if data.role == Role.owner:
        raise HTTPException(400, "Роль owner назначить нельзя")
    target = session.exec(select(User).where(User.email == data.email)).first()
    if target is None:
        raise HTTPException(404, "Пользователь с таким email не найден")
    todo_list = session.get(TodoList, list_id)
    if target.id == todo_list.owner_id:
        raise HTTPException(400, "Владелец уже имеет полный доступ")
    exists = session.exec(select(ListMember).where(
        ListMember.list_id == list_id, ListMember.user_id == target.id)).first()
    if exists:
        exists.role = data.role
        session.add(exists)
    else:
        session.add(ListMember(list_id=list_id, user_id=target.id, role=data.role))
    session.commit()
    return MemberOut(user_id=target.id, email=target.email,
                     username=target.username, role=data.role)


@router.delete("/lists/{list_id}/members/{member_user_id}", status_code=204)
def remove_member(list_id: int, member_user_id: int,
                  user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    role = get_list_role(session, user, list_id)
    if role != Role.owner and member_user_id != user.id:
        raise HTTPException(403, "Удалять участников может только владелец")
    member = session.exec(select(ListMember).where(
        ListMember.list_id == list_id, ListMember.user_id == member_user_id)).first()
    if member is None:
        raise HTTPException(404, "Участник не найден")
    session.delete(member)
    session.commit()


# ---------- Задачи ----------

@router.get("/lists/{list_id}/items", response_model=list[TodoItemOut])
def list_items(list_id: int, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    get_list_role(session, user, list_id)
    items = session.exec(select(TodoItem).where(TodoItem.list_id == list_id)).all()
    order = {"todo": 0, "doing": 1, "done": 2}
    return sorted(items, key=lambda i: (order[i.status.value], i.due_date or i.created_at.date()))


@router.post("/lists/{list_id}/items", response_model=TodoItemOut, status_code=201)
def create_item(list_id: int, data: TodoItemCreate,
                user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    role = get_list_role(session, user, list_id)
    if role == Role.viewer:
        raise HTTPException(403, "Зритель не может добавлять задачи")
    item = TodoItem(list_id=list_id, created_by=user.id, **data.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=TodoItemOut)
def update_item(item_id: int, data: TodoItemUpdate,
                user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    item = session.get(TodoItem, item_id)
    if item is None:
        raise HTTPException(404, "Задача не найдена")
    role = get_list_role(session, user, item.list_id)
    if role == Role.viewer:
        raise HTTPException(403, "Зритель не может менять задачи")
    was_done = item.status == TodoStatus.done
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    # момент выполнения нужен для статистики «сколько сделано в месяц»
    if item.status == TodoStatus.done and not was_done:
        item.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    elif item.status != TodoStatus.done:
        item.completed_at = None
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    item = session.get(TodoItem, item_id)
    if item is None:
        raise HTTPException(404, "Задача не найдена")
    role = get_list_role(session, user, item.list_id)
    if role == Role.viewer:
        raise HTTPException(403, "Зритель не может удалять задачи")
    session.delete(item)
    session.commit()

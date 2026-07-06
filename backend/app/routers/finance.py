"""Финансы. ВАЖНО: каждый запрос жёстко фильтруется по user_id текущего
пользователя — расшаривания нет по дизайну."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import User, Category, Transaction, Budget, CategoryKind
from ..schemas import (
    CategoryCreate, CategoryOut, TransactionCreate, TransactionOut,
    BudgetSet, BudgetOut, MonthSummary, CategorySummary,
)

router = APIRouter(prefix="/finance", tags=["finance"])


def _own_category(session: Session, user: User, category_id: int) -> Category:
    cat = session.get(Category, category_id)
    if cat is None or cat.user_id != user.id:
        raise HTTPException(404, "Категория не найдена")
    return cat


# ---------- Категории ----------

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    return session.exec(select(Category).where(Category.user_id == user.id)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryCreate, user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    cat = Category(user_id=user.id, name=data.name, kind=data.kind)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    cat = _own_category(session, user, category_id)
    used = session.exec(select(Transaction).where(
        Transaction.category_id == category_id)).first()
    if used:
        raise HTTPException(400, "Сначала удали операции этой категории")
    session.delete(cat)
    session.commit()


# ---------- Транзакции ----------

@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
                      user: User = Depends(get_current_user),
                      session: Session = Depends(get_session)):
    query = select(Transaction).where(Transaction.user_id == user.id)
    rows = session.exec(query).all()
    if month:
        rows = [t for t in rows if t.date.strftime("%Y-%m") == month]
    return sorted(rows, key=lambda t: t.date, reverse=True)


@router.post("/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(data: TransactionCreate, user: User = Depends(get_current_user),
                       session: Session = Depends(get_session)):
    _own_category(session, user, data.category_id)
    tx = Transaction(user_id=user.id, **data.model_dump())
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, user: User = Depends(get_current_user),
                       session: Session = Depends(get_session)):
    tx = session.get(Transaction, tx_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(404, "Операция не найдена")
    session.delete(tx)
    session.commit()


# ---------- Бюджеты ----------

@router.get("/budgets", response_model=list[BudgetOut])
def list_budgets(month: str = Query(pattern=r"^\d{4}-\d{2}$"),
                 user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    return session.exec(select(Budget).where(
        Budget.user_id == user.id, Budget.month == month)).all()


@router.put("/budgets", response_model=BudgetOut)
def set_budget(data: BudgetSet, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    cat = _own_category(session, user, data.category_id)
    if cat.kind != CategoryKind.expense:
        raise HTTPException(400, "Бюджет ставится только на категории расходов")
    budget = session.exec(select(Budget).where(
        Budget.user_id == user.id,
        Budget.category_id == data.category_id,
        Budget.month == data.month)).first()
    if budget:
        budget.limit_amount = data.limit_amount
    else:
        budget = Budget(user_id=user.id, **data.model_dump())
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


# ---------- Сводка и советы ----------

@router.get("/summary", response_model=MonthSummary)
def month_summary(month: str = Query(pattern=r"^\d{4}-\d{2}$"),
                  user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    categories = session.exec(select(Category).where(Category.user_id == user.id)).all()
    cat_by_id = {c.id: c for c in categories}
    transactions = [
        t for t in session.exec(select(Transaction).where(
            Transaction.user_id == user.id)).all()
        if t.date.strftime("%Y-%m") == month
    ]
    budgets = {
        b.category_id: b.limit_amount
        for b in session.exec(select(Budget).where(
            Budget.user_id == user.id, Budget.month == month)).all()
    }

    totals: dict[int, float] = {}
    for t in transactions:
        totals[t.category_id] = totals.get(t.category_id, 0.0) + t.amount

    income = sum(v for cid, v in totals.items()
                 if cat_by_id[cid].kind == CategoryKind.income)
    expense = sum(v for cid, v in totals.items()
                  if cat_by_id[cid].kind == CategoryKind.expense)
    savings = income - expense
    rate = (savings / income) if income > 0 else 0.0

    by_category = []
    for cid, total in sorted(totals.items(), key=lambda x: -x[1]):
        cat = cat_by_id[cid]
        limit = budgets.get(cid)
        by_category.append(CategorySummary(
            category_id=cid, name=cat.name, kind=cat.kind, total=round(total, 2),
            budget_limit=limit,
            budget_left=round(limit - total, 2) if limit is not None else None,
        ))

    advice: list[str] = []
    for cs in by_category:
        if cs.budget_limit is not None and cs.budget_left is not None:
            if cs.budget_left < 0:
                advice.append(f"Бюджет «{cs.name}» превышен на {abs(cs.budget_left):.0f} ₽ — притормози до конца месяца.")
            elif cs.budget_left < cs.budget_limit * 0.2:
                advice.append(f"В «{cs.name}» осталось меньше 20% бюджета ({cs.budget_left:.0f} ₽).")
    if income > 0:
        if rate < 0:
            advice.append("Расходы превышают доходы — начни с самой крупной категории расходов.")
        elif rate < 0.1:
            advice.append("Откладывается меньше 10% дохода. Попробуй правило «сначала заплати себе»: 10% сразу при поступлении.")
        elif rate >= 0.2:
            advice.append(f"Отличный темп: откладывается {rate * 100:.0f}% дохода. Подушка на 3 месяца расходов — {expense * 3:.0f} ₽.")
    expense_cats = [c for c in by_category if c.kind == CategoryKind.expense]
    if expense_cats and expense > 0 and expense_cats[0].total > expense * 0.4:
        advice.append(f"Категория «{expense_cats[0].name}» съедает больше 40% всех расходов — поставь на неё бюджет.")
    if not advice:
        advice.append("Всё под контролем. Добавляй операции регулярно, чтобы советы были точнее.")

    return MonthSummary(
        month=month, income_total=round(income, 2), expense_total=round(expense, 2),
        savings=round(savings, 2), savings_rate=round(rate, 4),
        by_category=by_category, advice=advice,
    )

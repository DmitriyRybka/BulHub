import { useCallback, useEffect, useState } from "react";
import { api, Category, Summary, Tx } from "../api/client";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const fmt = (n: number) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";

export default function FinancePage() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  // формы
  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<"income" | "expense">("expense");
  const [txCat, setTxCat] = useState<number | "">("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txNote, setTxNote] = useState("");
  const [budgetCat, setBudgetCat] = useState<number | "">("");
  const [budgetLimit, setBudgetLimit] = useState("");

  const load = useCallback(async () => {
    const [cats, transactions, sum] = await Promise.all([
      api<Category[]>("/finance/categories"),
      api<Tx[]>(`/finance/transactions?month=${month}`),
      api<Summary>(`/finance/summary?month=${month}`),
    ]);
    setCategories(cats);
    setTxs(transactions);
    setSummary(sum);
  }, [month]);

  useEffect(() => { load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const catById = new Map(categories.map((c) => [c.id, c]));
  const expenseCats = categories.filter((c) => c.kind === "expense");

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Финансы</h1>
        <div className="row">
          <span className="muted">Только ты видишь эти данные</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      {summary && (
        <div className="grid two">
          <div className="card">
            <h2>Итог месяца</h2>
            <div className="stack">
              <div className="spread"><span className="muted">Доходы</span>
                <span className="plus">+{fmt(summary.income_total)}</span></div>
              <div className="spread"><span className="muted">Расходы</span>
                <span className="minus">−{fmt(summary.expense_total)}</span></div>
              <div className="spread"><span>Накоплено</span>
                <strong className={summary.savings >= 0 ? "plus" : "minus"}>
                  {fmt(summary.savings)}
                  {summary.income_total > 0 && ` (${Math.round(summary.savings_rate * 100)}%)`}
                </strong></div>
            </div>
          </div>
          <div className="card">
            <h2>Советы</h2>
            <div className="stack">
              {summary.advice.map((a, i) => <p key={i} className="muted" style={{ margin: 0 }}>{a}</p>)}
            </div>
          </div>
        </div>
      )}

      {summary && summary.by_category.length > 0 && (
        <div className="card stack">
          <h2>По категориям</h2>
          {summary.by_category.map((c) => (
            <div key={c.category_id}>
              <div className="spread">
                <span>{c.name}</span>
                <span className={c.kind === "income" ? "plus" : ""}>
                  {c.kind === "income" ? "+" : ""}{fmt(c.total)}
                  {c.budget_limit != null && <span className="muted"> / {fmt(c.budget_limit)}</span>}
                </span>
              </div>
              {c.budget_limit != null && (
                <div className="bar">
                  <div className={c.total > c.budget_limit ? "over" : ""}
                    style={{ width: `${Math.min(100, (c.total / c.budget_limit) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="grid two">
        <div className="card stack">
          <h2>Добавить операцию</h2>
          <div className="row">
            <select value={txCat} onChange={(e) => setTxCat(Number(e.target.value))} style={{ flex: 1 }}>
              <option value="" disabled>Категория…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "income" ? "↑" : "↓"} {c.name}
                </option>
              ))}
            </select>
            <input type="number" placeholder="Сумма" value={txAmount} min={1} style={{ width: 110 }}
              onChange={(e) => setTxAmount(e.target.value)} />
          </div>
          <div className="row">
            <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            <input placeholder="Заметка" value={txNote} style={{ flex: 1 }}
              onChange={(e) => setTxNote(e.target.value)} />
            <button className="primary" disabled={txCat === "" || !txAmount}
              onClick={() => run(() => api("/finance/transactions", {
                method: "POST",
                body: { category_id: txCat, amount: Number(txAmount), date: txDate, note: txNote },
              })).then(() => { setTxAmount(""); setTxNote(""); })}>
              Записать
            </button>
          </div>

          <h2>Категории и бюджеты</h2>
          <div className="row">
            <input placeholder="Новая категория" value={catName} style={{ flex: 1 }}
              onChange={(e) => setCatName(e.target.value)} />
            <select value={catKind} onChange={(e) => setCatKind(e.target.value as "income" | "expense")}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <button disabled={!catName.trim()}
              onClick={() => run(() => api("/finance/categories", {
                method: "POST", body: { name: catName, kind: catKind },
              })).then(() => setCatName(""))}>+</button>
          </div>
          <div className="row">
            <select value={budgetCat} onChange={(e) => setBudgetCat(Number(e.target.value))} style={{ flex: 1 }}>
              <option value="" disabled>Бюджет на категорию…</option>
              {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Лимит" value={budgetLimit} min={1} style={{ width: 110 }}
              onChange={(e) => setBudgetLimit(e.target.value)} />
            <button disabled={budgetCat === "" || !budgetLimit}
              onClick={() => run(() => api("/finance/budgets", {
                method: "PUT",
                body: { category_id: budgetCat, month, limit_amount: Number(budgetLimit) },
              })).then(() => setBudgetLimit(""))}>
              Задать
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Операции · {month}</h2>
          {txs.length === 0 && <p className="muted">За этот месяц операций нет.</p>}
          {txs.map((t) => {
            const cat = catById.get(t.category_id);
            const income = cat?.kind === "income";
            return (
              <div key={t.id} className="item">
                <span>
                  {cat?.name ?? "—"}
                  {t.note && <span className="muted"> · {t.note}</span>}
                </span>
                <span className="row">
                  <span className="muted">{t.date.slice(8, 10)}.{t.date.slice(5, 7)}</span>
                  <span className={income ? "plus" : "minus"}>
                    {income ? "+" : "−"}{fmt(t.amount)}
                  </span>
                  <button className="ghost" aria-label="Удалить операцию"
                    onClick={() => run(() => api(`/finance/transactions/${t.id}`, { method: "DELETE" }))}>✕</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

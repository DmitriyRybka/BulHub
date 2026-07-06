import { useCallback, useEffect, useState } from "react";
import { api, Role, TodoItem, TodoList, TodoStatus } from "../api/client";

const NEXT: Record<TodoStatus, TodoStatus> = { todo: "doing", doing: "done", done: "todo" };
const LABEL: Record<TodoStatus, string> = { todo: "в планах", doing: "в работе", done: "готово" };

export default function TodosPage() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [active, setActive] = useState<TodoList | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [error, setError] = useState("");

  const [newList, setNewList] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");

  const loadLists = useCallback(async () => {
    const ls = await api<TodoList[]>("/todos/lists");
    setLists(ls);
    setActive((prev) => ls.find((x) => x.id === prev?.id) ?? ls[0] ?? null);
  }, []);

  useEffect(() => { loadLists().catch((e) => setError(String(e.message ?? e))); }, [loadLists]);

  const loadItems = useCallback(async () => {
    if (!active) return;
    setItems(await api<TodoItem[]>(`/todos/lists/${active.id}/items`));
  }, [active]);

  useEffect(() => { loadItems().catch((e) => setError(String(e.message ?? e))); }, [loadItems]);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const canEdit = active && active.my_role !== "viewer";
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="grid side">
      <aside className="stack">
        <div className="card stack">
          <h2>Списки</h2>
          {lists.map((l) => (
            <button key={l.id} className={l.id === active?.id ? "primary" : ""}
              style={{ textAlign: "left" }} onClick={() => setActive(l)}>
              {l.name}
            </button>
          ))}
          <div className="row">
            <input placeholder="Новый список" value={newList} style={{ flex: 1 }}
              onChange={(e) => setNewList(e.target.value)} />
            <button disabled={!newList.trim()} onClick={async () => {
              await api("/todos/lists", { method: "POST", body: { name: newList } });
              setNewList("");
              await loadLists();
            }}>+</button>
          </div>
        </div>

        {active?.my_role === "owner" && (
          <div className="card stack">
            <h2>Совместный доступ</h2>
            <input placeholder="email@пример.ru" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)} />
            <div className="row">
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} style={{ flex: 1 }}>
                <option value="editor">Редактор</option>
                <option value="viewer">Зритель</option>
              </select>
              <button disabled={!inviteEmail.trim()}
                onClick={() => run(() => api(`/todos/lists/${active.id}/members`, {
                  method: "POST", body: { email: inviteEmail, role: inviteRole },
                })).then(() => setInviteEmail(""))}>
                Пригласить
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="stack">
        {canEdit && (
          <div className="card stack">
            <h2>Новая задача</h2>
            <div className="row">
              <input placeholder="Что нужно не забыть?" value={title} style={{ flex: 2, minWidth: 180 }}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && title.trim() &&
                  run(() => api(`/todos/lists/${active!.id}/items`, {
                    method: "POST", body: { title, due_date: due || null },
                  })).then(() => setTitle(""))} />
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              <button className="primary" disabled={!title.trim()}
                onClick={() => run(() => api(`/todos/lists/${active!.id}/items`, {
                  method: "POST", body: { title, due_date: due || null },
                })).then(() => setTitle(""))}>
                Добавить
              </button>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="card stack">
          <div className="spread">
            <h2 style={{ margin: 0 }}>{active?.name ?? "Задачи"}</h2>
            <span className="muted">{doneCount} из {items.length} готово</span>
          </div>
          {items.length === 0 && <p className="muted">Список пуст — самое время что-нибудь запланировать.</p>}
          {items.map((i) => (
            <div key={i.id} className={`item todo ${i.status}`}>
              <span className="row">
                <button className="ghost" style={{ padding: 4 }} disabled={!canEdit}
                  aria-label={`Статус: ${LABEL[i.status]}. Нажми, чтобы сменить`}
                  onClick={() => run(() => api(`/todos/items/${i.id}`, {
                    method: "PATCH", body: { status: NEXT[i.status] },
                  }))}>
                  <span className={`status-dot ${i.status}`} />
                </button>
                <span className="title">{i.title}</span>
                <span className="badge">{LABEL[i.status]}</span>
              </span>
              <span className="row">
                {i.due_date && <span className="muted">до {i.due_date.slice(8, 10)}.{i.due_date.slice(5, 7)}</span>}
                {canEdit && (
                  <button className="ghost" aria-label="Удалить задачу"
                    onClick={() => run(() => api(`/todos/items/${i.id}`, { method: "DELETE" }))}>✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

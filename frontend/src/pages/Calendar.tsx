import { useCallback, useEffect, useState } from "react";
import { api, Member, Occurrence, Role, Space } from "../api/client";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [active, setActive] = useState<Space | null>(null);
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  // диапазон: сегодня + 14 дней
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + 14);

  // формы
  const [newSpace, setNewSpace] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [time, setTime] = useState("12:00");
  const [durMin, setDurMin] = useState(60);
  const [freq, setFreq] = useState("none");
  const [remind, setRemind] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");

  const loadSpaces = useCallback(async () => {
    const s = await api<Space[]>("/calendar/spaces");
    setSpaces(s);
    setActive((prev) => s.find((x) => x.id === prev?.id) ?? s[0] ?? null);
  }, []);

  useEffect(() => { loadSpaces().catch((e) => setError(String(e.message ?? e))); }, [loadSpaces]);

  const loadEvents = useCallback(async () => {
    if (!active) return;
    const params = new URLSearchParams({
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    });
    setOcc(await api<Occurrence[]>(`/calendar/spaces/${active.id}/occurrences?${params}`));
    setMembers(await api<Member[]>(`/calendar/spaces/${active.id}/members`));
  }, [active]);

  useEffect(() => { loadEvents().catch((e) => setError(String(e.message ?? e))); }, [loadEvents]);

  async function createSpace() {
    if (!newSpace.trim()) return;
    await api("/calendar/spaces", { method: "POST", body: { name: newSpace } });
    setNewSpace("");
    await loadSpaces();
  }

  async function createEvent() {
    if (!active || !title.trim()) return;
    setError("");
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + durMin * 60000);
    try {
      await api(`/calendar/spaces/${active.id}/events`, {
        method: "POST",
        body: {
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          recur_freq: freq,
          reminder_minutes: remind === "" ? null : Number(remind),
        },
      });
      setTitle("");
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function deleteEvent(id: number) {
    await api(`/calendar/events/${id}`, { method: "DELETE" });
    await loadEvents();
  }

  async function invite() {
    if (!active || !inviteEmail.trim()) return;
    setError("");
    try {
      await api(`/calendar/spaces/${active.id}/members`, {
        method: "POST",
        body: { email: inviteEmail, role: inviteRole },
      });
      setInviteEmail("");
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const canEdit = active && active.my_role !== "viewer";
  const byDay = occ.reduce<Record<string, Occurrence[]>>((acc, o) => {
    const day = o.start.slice(0, 10);
    (acc[day] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div className="grid side">
      <aside className="stack">
        <div className="card stack">
          <h2>Календари</h2>
          {spaces.map((s) => (
            <button key={s.id}
              className={s.id === active?.id ? "primary" : ""}
              style={{ textAlign: "left" }}
              onClick={() => setActive(s)}>
              {s.name} {s.is_personal ? "· личный" : ""}
            </button>
          ))}
          <div className="row">
            <input placeholder="Новый общий календарь" value={newSpace} style={{ flex: 1 }}
              onChange={(e) => setNewSpace(e.target.value)} />
            <button onClick={createSpace}>+</button>
          </div>
        </div>

        {active && !active.is_personal && (
          <div className="card stack">
            <h2>Участники</h2>
            {members.map((m) => (
              <div key={m.user_id} className="spread">
                <span>{m.username}</span>
                <span className={`badge ${m.role}`}>{m.role}</span>
              </div>
            ))}
            {active.my_role === "owner" && (
              <>
                <input placeholder="email@пример.ru" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)} />
                <div className="row">
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} style={{ flex: 1 }}>
                    <option value="viewer">Зритель</option>
                    <option value="editor">Редактор</option>
                  </select>
                  <button onClick={invite}>Пригласить</button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>

      <main className="stack">
        {canEdit && (
          <div className="card stack">
            <h2>Новое событие</h2>
            <div className="row">
              <input placeholder="Что запланируем?" value={title} style={{ flex: 2, minWidth: 180 }}
                onChange={(e) => setTitle(e.target.value)} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="row">
              <select value={durMin} onChange={(e) => setDurMin(Number(e.target.value))}>
                <option value={30}>30 мин</option>
                <option value={60}>1 час</option>
                <option value={120}>2 часа</option>
                <option value={180}>3 часа</option>
              </select>
              <select value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="none">Без повтора</option>
                <option value="daily">Каждый день</option>
                <option value="weekly">Каждую неделю</option>
                <option value="monthly">Каждый месяц</option>
              </select>
              <select value={remind} onChange={(e) => setRemind(e.target.value)}>
                <option value="">Без напоминания</option>
                <option value="15">За 15 минут</option>
                <option value="60">За час</option>
                <option value="1440">За день</option>
              </select>
              <button className="primary" onClick={createEvent}>Добавить</button>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="card">
          <div className="spread">
            <h2 style={{ margin: 0 }}>Ближайшие 14 дней</h2>
            {active && <span className={`badge ${active.my_role}`}>моя роль: {active.my_role}</span>}
          </div>
          {occ.length === 0 && <p className="muted">Пока пусто — добавь первое событие.</p>}
          {Object.entries(byDay).map(([day, items]) => (
            <div key={day}>
              <div className="daylabel">
                {new Date(day + "T00:00:00").toLocaleDateString("ru-RU", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </div>
              <div className="stack">
                {items.map((o, i) => (
                  <div key={`${o.event_id}-${i}`} className="item">
                    <span>
                      {o.title}
                      {o.reminder_minutes != null && (
                        <span className="muted"> · 🔔 за {o.reminder_minutes} мин</span>
                      )}
                    </span>
                    <span className="row">
                      <span className="muted">
                        {o.start.slice(11, 16)}–{o.end.slice(11, 16)}
                      </span>
                      {canEdit && (
                        <button className="ghost" onClick={() => deleteEvent(o.event_id)}
                          aria-label="Удалить событие">✕</button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

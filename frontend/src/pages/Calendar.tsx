import { useCallback, useEffect, useState } from "react";
import { api, Member, Occurrence, Role, Space } from "../api/client";
import MonthGrid from "../components/MonthGrid";
import { addDays, dayKey, dayTitle, monthGrid, parseUtc, timeHM, todayKey } from "../lib/dates";

type DayEvent = { id: string; eventId: number; title: string; allDay: boolean; start: Date; end: Date; remind: number | null };

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

// Для многодневных событий показываем, какая часть приходится на этот день
function timeLabel(e: DayEvent, key: string): string {
  if (e.allDay) return "Весь день";
  const last = new Date(Math.max(e.start.getTime(), e.end.getTime() - 1));
  const startsHere = dayKey(e.start) === key, endsHere = dayKey(last) === key;
  if (startsHere && endsHere) return `${timeHM(e.start)}–${timeHM(e.end)}`;
  if (startsHere) return `с ${timeHM(e.start)}`;
  if (endsHere) return `до ${timeHM(e.end)}`;
  return "Весь день";
}

export default function CalendarPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [active, setActive] = useState<Space | null>(null);
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState(todayKey);

  // формы
  const [newSpace, setNewSpace] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
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
    // грузим все 6 недель сетки, чтобы точки были и на днях соседних месяцев
    const grid = monthGrid(month);
    const params = new URLSearchParams({
      start: grid[0].toISOString(),
      end: addDays(grid[41], 1).toISOString(),
    });
    setOcc(await api<Occurrence[]>(`/calendar/spaces/${active.id}/occurrences?${params}`));
    setMembers(await api<Member[]>(`/calendar/spaces/${active.id}/members`));
  }, [active, month]);

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
  // Время с сервера — UTC без пояса: переводим в местное и раскладываем по дням;
  // многодневные события попадают в каждый свой день.
  const byDay = occ.reduce<Record<string, DayEvent[]>>((acc, o, i) => {
    const start = parseUtc(o.start), end = parseUtc(o.end);
    const last = new Date(Math.max(start.getTime(), end.getTime() - 1));
    let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let n = 0; d <= last && n < 42; n++, d = addDays(d, 1)) {
      (acc[dayKey(d)] ??= []).push({
        id: `${o.event_id}-${i}`, eventId: o.event_id, title: o.title,
        allDay: o.all_day, start, end, remind: o.reminder_minutes,
      });
    }
    return acc;
  }, {});
  for (const list of Object.values(byDay)) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
  }
  const marks = Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, v.length]));
  const dayEvents = byDay[selected] ?? [];

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
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} style={{ flex: "1 1 130px", minWidth: 130 }}>
                    <option value="viewer">Зритель</option>
                    <option value="editor">Редактор</option>
                  </select>
                  <button onClick={invite} style={{ flex: "1 1 auto" }}>Пригласить</button>
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
          <div className="spread" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Календарь</h2>
            {active && <span className={`badge ${active.my_role}`}>моя роль: {active.my_role}</span>}
          </div>
          <MonthGrid month={month} selected={selected} marks={marks}
            onSelect={(k) => { setSelected(k); setDate(k); }}
            onMonthChange={(d) => setMonth(firstOfMonth(d))} />
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>{dayTitle(selected)}</h2>
          {dayEvents.length === 0 && <p className="muted" style={{ margin: 0 }}>В этот день событий нет.</p>}
          {dayEvents.map((e) => (
            <div key={e.id} className="item">
              <span>
                {e.title}
                {e.remind != null && <span className="muted"> · 🔔 за {e.remind} мин</span>}
              </span>
              <span className="row">
                <span className="muted">{timeLabel(e, selected)}</span>
                {canEdit && (
                  <button className="ghost" onClick={() => deleteEvent(e.eventId)}
                    aria-label="Удалить событие">✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

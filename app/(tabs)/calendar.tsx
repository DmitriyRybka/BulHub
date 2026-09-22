import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, F } from "../../constants/ui";
import { MonthGrid } from "../../components/month-grid";
import { addDays, dayKey, dayTitle, monthGrid, parseUtc, timeHM, todayKey } from "../../lib/dates";

type Space = { id: number; name: string };
type Occ = { event_id: number; title: string; start: string; end: string; all_day: boolean };
type DayEvent = { id: string; title: string; allDay: boolean; start: Date; end: Date };

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function Calendar() {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [selected, setSelected] = useState(todayKey);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [occ, setOcc] = useState<Occ[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Space[]>("/calendar/spaces")
      .then((spaces) => { if (spaces.length) setSpaceId(spaces[0].id); })
      .catch((e) => setError(e.message));
  }, []);

  // Грузим все 6 недель сетки, чтобы точки были и на соседних месяцах
  useEffect(() => {
    if (spaceId == null) return;
    const grid = monthGrid(month);
    const start = encodeURIComponent(grid[0].toISOString());
    const end = encodeURIComponent(addDays(grid[41], 1).toISOString());
    let cancelled = false;
    api<Occ[]>(`/calendar/spaces/${spaceId}/occurrences?start=${start}&end=${end}`)
      .then((o) => { if (!cancelled) { setOcc(o); setError(""); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [spaceId, month]);

  // Раскладываем события по локальным дням; многодневные — на каждый день
  const byDay = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    occ.forEach((o, i) => {
      const start = parseUtc(o.start);
      const end = parseUtc(o.end);
      const last = new Date(Math.max(start.getTime(), end.getTime() - 1));
      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      for (let n = 0; d <= last && n < 42; n++, d = addDays(d, 1)) {
        (map[dayKey(d)] ??= []).push({
          id: `${o.event_id}-${i}`, title: o.title, allDay: o.all_day, start, end,
        });
      }
    });
    for (const list of Object.values(map)) {
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [occ]);

  const marks = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const [key, list] of Object.entries(byDay)) m[key] = list.map(() => C.accent);
    return m;
  }, [byDay]);

  const events = byDay[selected] ?? [];

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <MonthGrid
          month={month}
          selected={selected}
          marks={marks}
          onSelect={setSelected}
          onMonthChange={(d) => setMonth(firstOfMonth(d))}
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <Text style={s.day}>{dayTitle(selected)}</Text>
        {events.length ? (
          events.map((e) => (
            <View key={e.id} style={s.item}>
              <View style={s.bar} />
              <Text style={s.title}>{e.title}</Text>
              <Text style={s.time}>{timeLabel(e, selected)}</Text>
            </View>
          ))
        ) : (
          <Text style={s.empty}>Событий нет — добавь в веб-версии</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Для многодневных событий показываем, какая часть приходится на этот день
function timeLabel(e: DayEvent, key: string): string {
  if (e.allDay) return "Весь день";
  const startsHere = dayKey(e.start) === key;
  const endsHere = dayKey(new Date(Math.max(e.start.getTime(), e.end.getTime() - 1))) === key;
  if (startsHere && endsHere) return `${timeHM(e.start)}–${timeHM(e.end)}`;
  if (startsHere) return `с ${timeHM(e.start)}`;
  if (endsHere) return `до ${timeHM(e.end)}`;
  return "Весь день";
}

const s = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 16,
    width: "100%", maxWidth: 560, alignSelf: "center",
  },
  content: { paddingBottom: 110, gap: 8 },
  day: { color: C.good, fontSize: 13, fontFamily: F.semibold, marginTop: 12 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface,
    borderRadius: 10, padding: 13, borderWidth: 1, borderColor: C.border,
  },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: C.accent },
  title: { color: C.text, flex: 1, fontSize: 14, fontFamily: F.regular },
  time: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  empty: { color: C.muted, fontSize: 14, fontFamily: F.regular },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
});

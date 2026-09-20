import { useCallback, useEffect, useState } from "react";
import { View, Text, SectionList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, F } from "../../constants/ui";

type Space = { id: number; name: string };
type Occ = { event_id: number; title: string; start: string; end: string };

export default function Calendar() {
  const [sections, setSections] = useState<{ title: string; data: Occ[] }[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const spaces = await api<Space[]>("/calendar/spaces");
    if (!spaces.length) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 14);
    const params = `start=${start.toISOString()}&end=${end.toISOString()}`;
    const occ = await api<Occ[]>(`/calendar/spaces/${spaces[0].id}/occurrences?${params}`);
    // группируем по дню: SectionList хочет [{title, data}]
    const byDay: Record<string, Occ[]> = {};
    for (const o of occ) (byDay[o.start.slice(0, 10)] ??= []).push(o);
    setSections(Object.entries(byDay).map(([day, data]) => ({
      title: new Date(day + "T00:00:00").toLocaleDateString("ru-RU", {
        weekday: "long", day: "numeric", month: "long",
      }),
      data,
    })));
  }, []);

  useEffect(() => { load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <Text style={s.h1}>Ближайшие 14 дней</Text>
      {!!error && <Text style={s.error}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(o, i) => `${o.event_id}-${i}`}
        renderSectionHeader={({ section }) => <Text style={s.day}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={s.item}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.time}>{item.start.slice(11, 16)}–{item.end.slice(11, 16)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>Событий нет — добавь в веб-версии</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 6, width: "100%", maxWidth: 560, alignSelf: "center" },
  h1: { color: C.text, fontSize: 18, fontFamily: F.bold },
  day: { color: C.good, fontSize: 12, fontFamily: F.semibold, marginTop: 14, marginBottom: 6, textTransform: "capitalize" },
  item: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 10, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  title: { color: C.text, flex: 1, fontSize: 14, fontFamily: F.regular },
  time: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  empty: { color: C.muted, marginTop: 20, fontSize: 14, fontFamily: F.regular },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
});

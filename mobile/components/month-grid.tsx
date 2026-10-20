import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../constants/ui";
import {
  WEEKDAYS, addMonths, dayKey, monthGrid, monthTitle, sameMonth, todayKey,
} from "../lib/dates";

type Props = {
  month: Date;                        // любой день показываемого месяца
  selected?: string | null;           // ключ выбранного дня
  marks?: Record<string, string[]>;   // цвета точек под числом
  onSelect: (key: string) => void;
  onMonthChange: (month: Date) => void;
  compact?: boolean;                  // поменьше клетки — для модалки выбора даты
};

export function MonthGrid({ month, selected, marks, onSelect, onMonthChange, compact }: Props) {
  const today = todayKey();
  const days = monthGrid(month);
  const isCurrent = sameMonth(month, new Date());
  const cellH = compact ? 38 : 46;

  return (
    <View>
      <View style={s.header}>
        <Pressable style={s.nav} onPress={() => onMonthChange(addMonths(month, -1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>{monthTitle(month)}</Text>
          {!isCurrent && (
            <Pressable
              onPress={() => {
                onMonthChange(new Date());
                onSelect(today);
              }}
              hitSlop={6}
            >
              <Text style={s.todayLink}>Сегодня</Text>
            </Pressable>
          )}
        </View>
        <Pressable style={s.nav} onPress={() => onMonthChange(addMonths(month, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={20} color={C.text} />
        </Pressable>
      </View>

      <View style={s.row}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[s.weekday, i >= 5 && s.weekend]}>{w}</Text>
        ))}
      </View>

      {[0, 1, 2, 3, 4, 5].map((week) => (
        <View key={week} style={s.row}>
          {days.slice(week * 7, week * 7 + 7).map((d, i) => {
            const key = dayKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isSel = key === selected;
            const isToday = key === today;
            const dots = marks?.[key] ?? [];
            return (
              <Pressable
                key={key}
                style={[s.cell, { height: cellH }]}
                onPress={() => {
                  onSelect(key);
                  if (!inMonth) onMonthChange(d);
                }}
              >
                <View style={[s.num, isToday && s.numToday, isSel && s.numSelected]}>
                  <Text
                    style={[
                      s.numText,
                      i >= 5 && s.weekend,
                      !inMonth && s.outside,
                      isSel && s.numTextSelected,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                <View style={s.dots}>
                  {dots.slice(0, 3).map((color, j) => (
                    <View key={j} style={[s.dot, { backgroundColor: color }, !inMonth && s.outside]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  nav: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  titleWrap: { flex: 1, alignItems: "center" },
  title: { color: C.text, fontSize: 16, fontFamily: F.semibold },
  todayLink: { color: C.accent, fontSize: 12, fontFamily: F.medium, marginTop: 2 },
  row: { flexDirection: "row" },
  weekday: {
    flex: 1, textAlign: "center", color: C.muted, fontSize: 11,
    fontFamily: F.medium, paddingVertical: 6,
  },
  weekend: { color: C.bad },
  cell: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  num: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "transparent",
  },
  numToday: { borderColor: C.accent },
  numSelected: { backgroundColor: C.accent, borderColor: C.accent },
  numText: { color: C.text, fontSize: 14, fontFamily: F.medium },
  numTextSelected: { color: C.onAccent, fontFamily: F.bold },
  outside: { opacity: 0.35 },
  dots: { flexDirection: "row", gap: 3, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});

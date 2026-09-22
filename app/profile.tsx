import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError, setToken } from "../lib/api";
import { C, F } from "../constants/ui";
import { monthLabel, sinceLabel } from "../lib/dates";

type Me = { id: number; email: string; username: string };
type MonthStat = { month: string; done: number; created: number };
type Stats = {
  member_since: string;
  tasks: {
    total: number;
    done: number;
    active: number;
    doing: number;
    overdue: number;
    done_this_month: number;
    avg_done_per_month: number;
    best_month: MonthStat | null;
    by_month: MonthStat[];
  };
  events: { total: number; this_month: number };
};

// 1 задача, 2 задачи, 5 задач
function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
const TASKS: [string, string, string] = ["задача", "задачи", "задач"];
const num = (n: number) => String(n).replace(".", ","); // 2.5 → "2,5"

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // смещение пояса — чтобы сервер делил задачи по месяцам в нашем времени
    const tz = new Date().getTimezoneOffset();
    Promise.all([api<Me>("/auth/me"), api<Stats>(`/stats?tz=${tz}`)])
      .then(([m, s]) => { setMe(m); setStats(s); })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) {
          await setToken(null);
          router.replace("/login");
          return;
        }
        setError(e instanceof Error ? e.message : "Ошибка");
      });
  }, []);

  async function logout() {
    await setToken(null);
    router.replace("/login");
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={back} hitSlop={8} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.h1}>Профиль</Text>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}
      {!stats || !me ? (
        !error && <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.userCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(me.username || me.email).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{me.username}</Text>
              <Text style={s.muted}>{me.email}</Text>
              <Text style={s.small}>В Буль-Хабе {sinceLabel(stats.member_since)}</Text>
            </View>
          </View>

          <TaskSection t={stats.tasks} />

          <Text style={s.section}>Календарь</Text>
          <View style={s.grid}>
            <Tile value={String(stats.events.total)} label="событий всего" />
            <Tile value={String(stats.events.this_month)} label="в этом месяце" />
          </View>

          <Pressable style={s.logout} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={C.bad} />
            <Text style={s.logoutText}>Выйти из аккаунта</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TaskSection({ t }: { t: Stats["tasks"] }) {
  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return (
    <>
      <Text style={s.section}>Задачи</Text>
      <View style={s.grid}>
        <Tile value={String(t.done)} label="выполнено всего" />
        <Tile value={num(t.avg_done_per_month)} label="в среднем за месяц" />
        <Tile value={String(t.active)} label={t.doing ? `активных, ${t.doing} в работе` : "активных"} />
        <Tile value={String(t.overdue)} label="просрочено" icon={t.overdue ? "alert-circle" : undefined} />
      </View>

      {/* Метр: доля выполненных — одна цифра, поэтому не график, а полоса */}
      <View style={s.card}>
        <View style={s.meterHead}>
          <Text style={s.cardTitle}>Выполнено</Text>
          <Text style={s.meterValue}>{pct}%</Text>
        </View>
        <View style={s.meterTrack} accessibilityLabel={`Выполнено ${pct} процентов задач`}>
          <View style={[s.meterFill, { width: `${pct}%` }]} />
        </View>
        {/* после «из» — родительный падеж: из 1 задачи, из 3 задач, из 21 задачи */}
        <Text style={s.small}>{t.done} из {t.total} {plural(t.total, ["задачи", "задач", "задач"])}</Text>
      </View>

      <MonthChart months={t.by_month} best={t.best_month} />
    </>
  );
}

const CHART_H = 110;

// Один ряд — одна акцентная заливка (проверена валидатором: контраст к фону ≥ 3:1).
// Выбранный месяц выделяем подписью значения и жирной подписью месяца, а не цветом.
function MonthChart({ months, best }: { months: MonthStat[]; best: MonthStat | null }) {
  const [sel, setSel] = useState(months.length - 1); // по умолчанию текущий месяц
  const max = Math.max(1, ...months.map((m) => m.done));
  const cur = months[sel];

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Выполнено по месяцам</Text>

      <View style={s.chart}>
        {months.map((m, i) => {
          const h = m.done ? Math.max(4, (m.done / max) * CHART_H) : 0;
          const active = i === sel;
          return (
            // Колонка целиком — зона нажатия, она крупнее самого столбика.
            // Колонки стоят вплотную: отрезки базовой линии сливаются в одну.
            <Pressable
              key={m.month}
              style={s.col}
              onPress={() => setSel(i)}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(m.month)}: выполнено ${m.done}`}
            >
              <View style={s.plot}>
                <Text style={[s.barValue, !active && s.hidden]}>{m.done}</Text>
                <View style={[s.bar, { height: h }]} />
              </View>
              <View style={s.baseline} />
              <Text style={[s.axis, active && s.axisActive]}>{monthLabel(m.month, true)}</Text>
            </Pressable>
          );
        })}
      </View>

      {cur && (
        <Text style={s.caption}>
          {monthLabel(cur.month)}: выполнено {cur.done}, создано {cur.created}
        </Text>
      )}
      {!!best && best.done > 0 && (
        <Text style={s.small}>
          Лучший месяц — {monthLabel(best.month).toLowerCase()}: {best.done} {plural(best.done, TASKS)}
        </Text>
      )}
    </View>
  );
}

function Tile({ value, label, icon }: {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.tile}>
      <View style={s.tileRow}>
        {/* статусный цвет — только вместе с иконкой и подписью, не сам по себе */}
        {icon && <Ionicons name={icon} size={18} color={C.bad} />}
        <Text style={s.tileValue}>{value}</Text>
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 12, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  h1: { color: C.text, fontSize: 20, fontFamily: F.bold },
  content: { paddingBottom: 40, gap: 10 },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },

  userCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.onAccent, fontSize: 24, fontFamily: F.bold },
  name: { color: C.text, fontSize: 18, fontFamily: F.semibold },
  muted: { color: C.muted, fontSize: 13, fontFamily: F.regular, marginTop: 2 },
  small: { color: C.muted, fontSize: 12, fontFamily: F.regular, marginTop: 4 },

  section: { color: C.good, fontSize: 13, fontFamily: F.semibold, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileValue: { color: C.text, fontSize: 26, fontFamily: F.bold },
  tileLabel: { color: C.muted, fontSize: 12, fontFamily: F.medium, marginTop: 2 },

  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, gap: 6 },
  cardTitle: { color: C.text, fontSize: 14, fontFamily: F.semibold },
  meterHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  meterValue: { color: C.text, fontSize: 18, fontFamily: F.bold },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: "hidden", marginTop: 4 },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: C.accent },

  chart: { flexDirection: "row", marginTop: 8, marginBottom: 4 },
  col: { flex: 1, alignItems: "center" },
  // над столбиком — место под подпись значения
  plot: { height: CHART_H + 20, justifyContent: "flex-end", alignItems: "center" },
  // тонкий столбик, скругление 4px только сверху — низ прижат к базовой линии
  bar: { width: 22, backgroundColor: C.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue: { color: C.text, fontSize: 12, fontFamily: F.semibold, marginBottom: 4 },
  hidden: { opacity: 0 },
  baseline: { alignSelf: "stretch", height: 1, backgroundColor: C.border },
  axis: { color: C.muted, fontSize: 11, fontFamily: F.medium, marginTop: 6 },
  axisActive: { color: C.text, fontFamily: F.bold },
  caption: { color: C.text, fontSize: 13, fontFamily: F.medium },

  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  logoutText: { color: C.bad, fontSize: 14, fontFamily: F.semibold },
});

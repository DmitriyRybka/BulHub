import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { C, F } from "../../constants/ui";

type Summary = {
  income_total: number; expense_total: number; savings: number;
  advice: string[];
};
type Tx = { id: number; category_id: number; amount: number; date: string; note: string };
type Cat = { id: number; name: string; kind: "income" | "expense" };

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";

export default function Finance() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Map<number, Cat>>(new Map());
  const [error, setError] = useState("");
  const month = new Date().toISOString().slice(0, 7);

  const load = useCallback(async () => {
    const [sum, t, c] = await Promise.all([
      api<Summary>(`/finance/summary?month=${month}`),
      api<Tx[]>(`/finance/transactions?month=${month}`),
      api<Cat[]>("/finance/categories"),
    ]);
    setSummary(sum);
    setTxs(t);
    setCats(new Map(c.map((x) => [x.id, x])));
  }, [month]);

  useEffect(() => { load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <Text style={s.h1}>Финансы · {month}</Text>
      {!!error && <Text style={s.error}>{error}</Text>}
      {summary && (
        <View style={s.card}>
          <Row label="Доходы" value={"+" + fmt(summary.income_total)} color={C.good} />
          <Row label="Расходы" value={"−" + fmt(summary.expense_total)} color={C.bad} />
          <Row label="Накоплено" value={fmt(summary.savings)}
            color={summary.savings >= 0 ? C.good : C.bad} />
          {summary.advice.map((a, i) => <Text key={i} style={s.advice}>{a}</Text>)}
        </View>
      )}
      <FlatList
        data={txs}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => {
          const cat = cats.get(item.category_id);
          const income = cat?.kind === "income";
          return (
            <View style={s.item}>
              <Text style={s.title}>{cat?.name ?? "—"}{item.note ? ` · ${item.note}` : ""}</Text>
              <Text style={[s.amount, { color: income ? C.good : C.bad }]}>
                {income ? "+" : "−"}{fmt(item.amount)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>Операций за месяц нет</Text>}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.srow}>
      <Text style={s.slabel}>{label}</Text>
      <Text style={[s.svalue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 10, width: "100%", maxWidth: 560, alignSelf: "center" },
  h1: { color: C.text, fontSize: 18, fontFamily: F.bold },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: C.border },
  srow: { flexDirection: "row", justifyContent: "space-between" },
  slabel: { color: C.muted, fontSize: 14, fontFamily: F.regular },
  svalue: { fontSize: 14, fontFamily: F.semibold },
  advice: { color: C.muted, fontSize: 12, fontFamily: F.regular, marginTop: 4 },
  item: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 10, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  title: { color: C.text, flex: 1, marginRight: 8, fontSize: 14, fontFamily: F.regular },
  amount: { fontSize: 14, fontFamily: F.medium },
  empty: { color: C.muted, marginTop: 20, fontSize: 14, fontFamily: F.regular },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
});

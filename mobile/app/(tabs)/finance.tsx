import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { C, F } from "../../constants/ui";
import { TransactionForm, type Cat, type NewTransaction } from "../../components/transaction-form";
import { dayKey, dayTitle, monthLabel, shortDay } from "../../lib/dates";

type Summary = {
  income_total: number; expense_total: number; savings: number;
  advice: string[];
};
type Tx = { id: number; category_id: number; amount: number; date: string; note: string };

// до копеек, но без лишних нулей: 350 ₽, 99,9 ₽
const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " ₽";

export default function Finance() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Tx | null>(null);
  // месяц по местному времени: toISOString дал бы UTC и в первые часы 1-го числа — прошлый месяц
  const month = dayKey(new Date()).slice(0, 7);

  const load = useCallback(async () => {
    const [sum, t, c] = await Promise.all([
      api<Summary>(`/finance/summary?month=${month}`),
      api<Tx[]>(`/finance/transactions?month=${month}`),
      api<Cat[]>("/finance/categories"),
    ]);
    setSummary(sum);
    setTxs(t);
    setCats(c);
    setError("");
  }, [month]);

  useEffect(() => { load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  // Категории может ещё не быть — тогда сначала заводим её, потом саму операцию.
  // Трата это или доход, задаёт тип категории — у операции своего типа нет.
  async function addTransaction(t: NewTransaction) {
    let categoryId = t.categoryId;
    if (categoryId == null) {
      const created = await api<Cat>("/finance/categories", {
        method: "POST", body: { name: t.categoryName, kind: t.kind },
      });
      categoryId = created.id;
    }
    await api("/finance/transactions", {
      method: "POST",
      body: { category_id: categoryId, amount: t.amount, date: t.date, note: t.note },
    });
    await load();
  }

  async function remove(tx: Tx) {
    await api(`/finance/transactions/${tx.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  const catById = new Map(cats.map((c) => [c.id, c]));

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Финансы</Text>
          <Text style={s.month}>{monthLabel(month)}</Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={18} color={C.onAccent} />
          <Text style={s.addText}>Добавить</Text>
        </Pressable>
      </View>

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
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => {
          const cat = catById.get(item.category_id);
          const income = cat?.kind === "income";
          return (
            <Pressable style={s.item} onPress={() => setSelected(item)}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.title} numberOfLines={1}>
                  {cat?.name ?? "—"}{item.note ? ` · ${item.note}` : ""}
                </Text>
                <Text style={s.date}>{shortDay(item.date)}</Text>
              </View>
              <Text style={[s.amount, { color: income ? C.good : C.bad }]}>
                {income ? "+" : "−"}{fmt(item.amount)}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={s.empty}>Операций за месяц нет — нажми «Добавить», чтобы внести первую</Text>
        }
      />

      <TransactionForm visible={adding} categories={cats} onSubmit={addTransaction} onClose={() => setAdding(false)} />
      <TxModal
        tx={selected}
        cat={selected ? catById.get(selected.category_id) : undefined}
        onDelete={remove}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

function TxModal({ tx, cat, onDelete, onClose }: {
  tx: Tx | null;
  cat?: Cat;
  onDelete: (tx: Tx) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setError(""); setBusy(false); }, [tx]);
  if (!tx) return null;
  const income = cat?.kind === "income";

  async function del() {
    if (!tx) return;
    setBusy(true);
    try {
      await onDelete(tx);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось удалить");
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={[s.sheetAmount, { color: income ? C.good : C.bad }]}>
            {income ? "+" : "−"}{fmt(tx.amount)}
          </Text>
          <Text style={s.sheetCat}>{cat?.name ?? "Без категории"}</Text>
          <Text style={s.sheetMeta}>{dayTitle(tx.date)}</Text>
          {!!tx.note && <Text style={s.sheetNote}>{tx.note}</Text>}
          {!!error && <Text style={s.error}>{error}</Text>}
          <View style={s.sheetFooter}>
            <Pressable style={s.deleteBtn} onPress={del} disabled={busy}>
              {busy ? <ActivityIndicator color={C.bad} /> : (
                <>
                  <Ionicons name="trash-outline" size={16} color={C.bad} />
                  <Text style={s.deleteText}>Удалить</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={6}>
              <Text style={s.close}>Закрыть</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  header: { flexDirection: "row", alignItems: "center" },
  h1: { color: C.text, fontSize: 18, fontFamily: F.bold },
  month: { color: C.muted, fontSize: 12, fontFamily: F.medium, marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  addText: { color: C.onAccent, fontSize: 14, fontFamily: F.semibold },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: C.border },
  srow: { flexDirection: "row", justifyContent: "space-between" },
  slabel: { color: C.muted, fontSize: 14, fontFamily: F.regular },
  svalue: { fontSize: 14, fontFamily: F.semibold },
  advice: { color: C.muted, fontSize: 12, fontFamily: F.regular, marginTop: 4 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  title: { color: C.text, fontSize: 14, fontFamily: F.regular },
  date: { color: C.muted, fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  amount: { fontSize: 14, fontFamily: F.medium },
  empty: { color: C.muted, marginTop: 20, fontSize: 14, fontFamily: F.regular, textAlign: "center" },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },

  backdrop: { flex: 1, backgroundColor: "rgba(8, 6, 14, 0.7)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 360, backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, gap: 4 },
  sheetAmount: { fontSize: 28, fontFamily: F.bold },
  sheetCat: { color: C.text, fontSize: 16, fontFamily: F.semibold, marginTop: 4 },
  sheetMeta: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  sheetNote: { color: C.text, fontSize: 14, fontFamily: F.regular, marginTop: 6 },
  sheetFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, minWidth: 110, justifyContent: "center" },
  deleteText: { color: C.bad, fontSize: 14, fontFamily: F.semibold },
  close: { color: C.muted, fontSize: 14, fontFamily: F.medium },
});

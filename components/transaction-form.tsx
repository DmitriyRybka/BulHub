import { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../constants/ui";
import { MonthGrid } from "./month-grid";
import { addDays, dayKey, fromKey, shortDay, todayKey } from "../lib/dates";

export type Kind = "income" | "expense";
export type Cat = { id: number; name: string; kind: Kind };
export type NewTransaction = {
  kind: Kind;
  amount: number;
  categoryId: number | null; // null — категории ещё нет на сервере, её надо создать
  categoryName: string;
  date: string;              // "YYYY-MM-DD"
  note: string;
};

// Привычные категории. На сервере категория появляется при первой операции в ней —
// у новых пользователей категорий нет совсем, а без неё операцию не сохранить.
// Категории различаются по типу: «Другое» может быть и у трат, и у доходов.
const DEFAULTS: Record<Kind, string[]> = {
  expense: ["Продукты", "Кафе", "Транспорт", "Дом", "Здоровье", "Развлечения", "Одежда", "Подписки", "Другое"],
  income: ["Зарплата", "Подработка", "Подарки", "Кэшбэк", "Проценты", "Другое"],
};

// "1 250,50" → 1250.5; не больше двух знаков после запятой
function parseAmount(s: string): number | null {
  const clean = s.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && n < 1e9 ? n : null;
}

type Props = {
  visible: boolean;
  categories: Cat[];
  onSubmit: (t: NewTransaction) => Promise<void>;
  onClose: () => void;
};

export function TransactionForm({ visible, categories, onSubmit, onClose }: Props) {
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string | null>(null); // имя выбранной категории
  const [custom, setCustom] = useState<string | null>(null); // режим «своя категория»
  const [date, setDate] = useState(todayKey);
  const [showGrid, setShowGrid] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setKind("expense"); setAmount(""); setPicked(null); setCustom(null); setDate(todayKey());
    setShowGrid(false); setMonth(new Date()); setNote(""); setError("");
  }, [visible]);

  // свои категории этого типа + стандартные, которых ещё нет (без учёта регистра)
  const own = categories.filter((c) => c.kind === kind);
  const ownNames = new Set(own.map((c) => c.name.toLowerCase()));
  const options = [...own.map((c) => c.name), ...DEFAULTS[kind].filter((d) => !ownNames.has(d.toLowerCase()))];

  // у трат и доходов разные категории — выбор сбрасываем
  function switchKind(k: Kind) {
    if (k === kind) return;
    setKind(k); setPicked(null); setCustom(null); setError("");
  }

  const today = todayKey();
  const yesterday = dayKey(addDays(new Date(), -1));
  const otherDate = date !== today && date !== yesterday;

  const value = parseAmount(amount);
  const categoryName = (custom ?? picked ?? "").trim();
  const ready = value != null && categoryName.length > 0 && !busy;

  async function save() {
    if (value == null) return setError("Введи сумму, например 350 или 99,90");
    if (!categoryName) return setError("Выбери категорию");
    const existing = own.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
    setBusy(true);
    setError("");
    try {
      await onSubmit({ kind, amount: value, categoryId: existing?.id ?? null, categoryName, date, note: note.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.tabs}>
              {([["expense", "Трата"], ["income", "Доход"]] as const).map(([k, label]) => {
                const active = kind === k;
                return (
                  <Pressable key={k} style={[s.tab, active && s.tabActive]} onPress={() => switchKind(k)}>
                    <Ionicons
                      name={k === "expense" ? "arrow-down" : "arrow-up"}
                      size={14}
                      color={active ? C.onAccent : C.muted}
                    />
                    <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.amountRow}>
              <TextInput
                style={s.amount}
                value={amount}
                onChangeText={(t) => { setAmount(t.replace(/[^\d.,\s]/g, "")); setError(""); }}
                placeholder="0"
                placeholderTextColor={C.border}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={14}
              />
              <Text style={s.currency}>₽</Text>
            </View>

            <Text style={s.label}>Категория</Text>
            <View style={s.chips}>
              {options.map((name) => {
                const active = custom == null && picked === name;
                return (
                  <Pressable
                    key={name}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => { setPicked(name); setCustom(null); setError(""); }}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{name}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[s.chip, custom != null && s.chipActive]} onPress={() => setCustom(custom ?? "")}>
                <Ionicons name="add" size={14} color={custom != null ? C.onAccent : C.muted} />
                <Text style={[s.chipText, custom != null && s.chipTextActive]}>Своя</Text>
              </Pressable>
            </View>
            {custom != null && (
              <TextInput
                style={s.input}
                value={custom}
                onChangeText={(t) => { setCustom(t); setError(""); }}
                placeholder="Название категории"
                placeholderTextColor={C.muted}
                maxLength={60}
                autoFocus
              />
            )}

            <Text style={s.label}>Дата</Text>
            <View style={s.chips}>
              {[{ key: today, label: "Сегодня" }, { key: yesterday, label: "Вчера" }].map((d) => {
                const active = date === d.key;
                return (
                  <Pressable key={d.label} style={[s.chip, active && s.chipActive]}
                    onPress={() => { setDate(d.key); setShowGrid(false); }}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{d.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[s.chip, otherDate && s.chipActive]}
                onPress={() => { setMonth(fromKey(date)); setShowGrid(!showGrid); }}>
                <Ionicons name="calendar-outline" size={14} color={otherDate ? C.onAccent : C.muted} />
                <Text style={[s.chipText, otherDate && s.chipTextActive]}>
                  {otherDate ? shortDay(date) : "Другая дата"}
                </Text>
              </Pressable>
            </View>
            {showGrid && (
              <MonthGrid compact month={month} selected={date} onMonthChange={setMonth}
                onSelect={(k) => { setDate(k); setShowGrid(false); }} />
            )}

            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder="Комментарий (необязательно)"
              placeholderTextColor={C.muted}
              maxLength={200}
            />

            {!!error && <Text style={s.error}>{error}</Text>}

            <View style={s.footer}>
              <Pressable onPress={onClose} hitSlop={6}>
                <Text style={s.cancel}>Отмена</Text>
              </Pressable>
              <Pressable style={[s.saveBtn, !ready && s.saveBtnOff]} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.saveText}>Сохранить</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  // карточка ближе к верху: на телефоне снизу будет клавиатура
  backdrop: { flex: 1, backgroundColor: "rgba(8, 6, 14, 0.7)", alignItems: "center", justifyContent: "flex-start", padding: 16, paddingTop: 48 },
  card: { width: "100%", maxWidth: 400, maxHeight: "100%", backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  content: { padding: 16, gap: 10 },
  tabs: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 3 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  tabTextActive: { color: C.onAccent, fontFamily: F.semibold },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  amount: { flex: 1, minWidth: 0, color: C.text, fontSize: 30, fontFamily: F.bold, paddingVertical: 10 },
  currency: { color: C.muted, fontSize: 24, fontFamily: F.semibold },
  label: { color: C.muted, fontSize: 12, fontFamily: F.medium, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 13, fontFamily: F.medium },
  chipTextActive: { color: C.onAccent, fontFamily: F.semibold },
  input: { backgroundColor: C.surface, color: C.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.regular, borderWidth: 1, borderColor: C.border },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
  footer: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 18, marginTop: 4 },
  cancel: { color: C.muted, fontSize: 14, fontFamily: F.medium },
  saveBtn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, minWidth: 120, alignItems: "center" },
  saveBtnOff: { opacity: 0.45 },
  saveText: { color: C.onAccent, fontSize: 14, fontFamily: F.semibold },
});

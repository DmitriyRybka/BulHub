import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { router } from "expo-router";
import { api, ApiError, getToken, setToken } from "../../lib/api";
import { C, F } from "../../constants/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerModal } from "../../components/date-picker-modal";
import { ReminderModal } from "../../components/reminder-modal";
import { SwipeRow } from "../../components/swipe-row";
import { dateTimeLabel, daysBetween, parseUtc, shortDay, todayKey } from "../../lib/dates";
import { ensurePermission, syncReminders } from "../../lib/reminders";

type TodoList = { id: number; name: string };
type Item = {
  id: number;
  title: string;
  status: "todo" | "doing" | "done";
  due_date: string | null;   // "YYYY-MM-DD"
  remind_at: string | null;  // UTC без суффикса пояса
};
type Picker = { kind: "due" | "remind"; item: Item | null }; // item = null — черновик новой задачи

// Тап переключает «в работе», выполнение — свайпом вправо.
// Тап по выполненной (видна при «Показать выполненные») возвращает её в работу.
const TAP_NEXT = { todo: "doing", doing: "todo", done: "todo" } as const;
const UNDO_MS = 4000;
const DOT = { todo: C.muted, doing: C.accent, done: C.good } as const;

// Просрочено — красным, сегодня/завтра — акцентом, остальное приглушённо
function dueColor(due: string, done: boolean): string {
  if (done) return C.muted;
  const diff = daysBetween(todayKey(), due);
  if (diff < 0) return C.bad;
  if (diff <= 1) return C.accent;
  return C.muted;
}

// Прошедшее или у выполненной задачи — приглушённо: уведомления уже не будет
function remindColor(remind: string, done: boolean): string {
  return done || parseUtc(remind).getTime() <= Date.now() ? C.muted : C.accent;
}

export default function Todos() {
  const [listId, setListId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [hideDone, setHideDone] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftDue, setDraftDue] = useState<string | null>(null);
  const [draftRemind, setDraftRemind] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  // последняя смахнутая задача (с прежним статусом) — для кнопки «Отменить»
  const [undo, setUndo] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!(await getToken())) { router.replace("/login"); return; }
    const lists = await api<TodoList[]>("/todos/lists");
    if (!lists.length) return;
    setListId(lists[0].id);
    setItems(await api<Item[]>(`/todos/lists/${lists[0].id}/items`));
  }, []);

  // На логин — только если токен протух; сетевые и прочие ошибки показываем тут.
  const fail = useCallback(async (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      await setToken(null);
      router.replace("/login");
      return;
    }
    setError(e instanceof Error ? e.message : "Ошибка");
  }, []);

  useEffect(() => { load().catch(fail); }, [load, fail]);

  // Любое изменение задач — пересверяем уведомления на телефоне
  useEffect(() => {
    if (listId != null) syncReminders(listId, items).catch(() => {});
  }, [listId, items]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = async () => {
    if (listId != null) setItems(await api<Item[]>(`/todos/lists/${listId}/items`));
  };

  async function add() {
    const text = title.trim();
    if (!text || busy) return;
    if (!listId) { setError("Нет списка дел — создай его в веб-версии"); return; }
    setBusy(true);
    setError("");
    try {
      await api(`/todos/lists/${listId}/items`, {
        method: "POST",
        body: {
          title: text,
          ...(draftDue ? { due_date: draftDue } : {}),
          ...(draftRemind ? { remind_at: draftRemind } : {}),
        },
      });
      setTitle("");
      setDraftDue(null);
      setDraftRemind(null);
      await reload();
    } catch (e) {
      await fail(e);
    } finally {
      setBusy(false);
    }
  }

  // Меняем поле сразу на экране, потом отправляем; при ошибке — перечитываем с сервера
  async function patch(item: Item, fields: Partial<Pick<Item, "due_date" | "remind_at">>) {
    setError("");
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...fields } : i)));
    try {
      await api(`/todos/items/${item.id}`, { method: "PATCH", body: fields });
    } catch (e) {
      await reload().catch(() => {});
      await fail(e);
    }
  }

  async function setStatus(item: Item, status: Item["status"]) {
    setError("");
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    try {
      await api(`/todos/items/${item.id}`, { method: "PATCH", body: { status } });
    } catch (e) {
      await reload().catch(() => {});
      await fail(e);
    }
  }

  function complete(item: Item) {
    setUndo(item);
    setStatus(item, "done");
  }

  function undoComplete() {
    if (!undo) return;
    setUndo(null);
    setStatus(undo, undo.status);
  }

  async function onPicked(value: string | null) {
    if (!picker) return;
    if (picker.kind === "remind" && value && !(await ensurePermission())) {
      setError("Уведомления запрещены — разреши их для Expo Go в настройках телефона");
      return;
    }
    if (picker.item) {
      await patch(picker.item, picker.kind === "due" ? { due_date: value } : { remind_at: value });
    } else if (picker.kind === "due") {
      setDraftDue(value);
    } else {
      setDraftRemind(value);
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length;

  const pickerValue = !picker
    ? null
    : picker.kind === "due"
      ? (picker.item ? picker.item.due_date : draftDue)
      : (picker.item ? picker.item.remind_at : draftRemind);

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1, minWidth: 0 }]} placeholder="Новая задача"
          placeholderTextColor={C.muted} value={title} onChangeText={setTitle}
          onSubmitEditing={add} returnKeyType="done" submitBehavior="submit" />
        <Pressable style={[s.iconBtn, !!draftDue && s.iconBtnActive]} onPress={() => setPicker({ kind: "due", item: null })}>
          <Ionicons name="calendar-outline" size={18} color={draftDue ? C.onAccent : C.muted} />
        </Pressable>
        <Pressable style={[s.iconBtn, !!draftRemind && s.iconBtnActive]} onPress={() => setPicker({ kind: "remind", item: null })}>
          <Ionicons name="alarm-outline" size={18} color={draftRemind ? C.onAccent : C.muted} />
        </Pressable>
        <Pressable style={[s.btn, busy && s.btnBusy]} onPress={add} disabled={busy}>
          <Text style={s.btnText}>+</Text>
        </Pressable>
      </View>

      {(!!draftDue || !!draftRemind) && (
        <View style={s.draftRow}>
          {!!draftDue && (
            <View style={s.draftChip}>
              <Ionicons name="calendar-outline" size={12} color={C.accent} />
              <Text style={s.draftText}>{shortDay(draftDue)}</Text>
              <Pressable onPress={() => setDraftDue(null)} hitSlop={8}>
                <Ionicons name="close" size={13} color={C.muted} />
              </Pressable>
            </View>
          )}
          {!!draftRemind && (
            <View style={s.draftChip}>
              <Ionicons name="alarm-outline" size={12} color={C.accent} />
              <Text style={s.draftText}>{dateTimeLabel(parseUtc(draftRemind))}</Text>
              <Pressable onPress={() => setDraftRemind(null)} hitSlop={8}>
                <Ionicons name="close" size={13} color={C.muted} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {!!error && <Text style={s.error}>{error}</Text>}
      {(doneCount > 0 || !hideDone) && (
        <Pressable style={s.filterBtn} onPress={() => setHideDone(!hideDone)}>
          <Text style={s.filterText}>
            {hideDone ? `Показать выполненные (${doneCount})` : "Скрыть выполненные"}
          </Text>
        </Pressable>
      )}

      <FlatList
        data={hideDone ? items.filter((i) => i.status !== "done") : items}
        // статус в ключе: после смены статуса строка монтируется заново,
        // и уехавшая за край после свайпа не остаётся невидимой
        keyExtractor={(i) => `${i.id}-${i.status}`}
        ListEmptyComponent={
          items.length ? <Text style={s.empty}>Всё сделано 🎉</Text> : <Text style={s.empty}>Задач пока нет</Text>
        }
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => {
          const done = item.status === "done";
          return (
            <SwipeRow enabled={!done} onSwipe={() => complete(item)}>
              <View style={s.item}>
                <Pressable style={s.itemMain} onPress={() => setStatus(item, TAP_NEXT[item.status])}>
                  <View style={[s.dot, { backgroundColor: DOT[item.status] }]} />
                  <View style={s.itemText}>
                    <Text style={[s.title, done && s.done]}>{item.title}</Text>
                    {(!!item.due_date || !!item.remind_at) && (
                      <View style={s.meta}>
                        {!!item.due_date && (
                          <Text style={[s.metaText, { color: dueColor(item.due_date, done) }]}>
                            {shortDay(item.due_date)}
                          </Text>
                        )}
                        {!!item.remind_at && (
                          <View style={s.metaRemind}>
                            <Ionicons name="alarm-outline" size={12} color={remindColor(item.remind_at, done)} />
                            <Text style={[s.metaText, { color: remindColor(item.remind_at, done) }]}>
                              {dateTimeLabel(parseUtc(item.remind_at))}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </Pressable>
                <Pressable style={s.sideBtn} onPress={() => setPicker({ kind: "due", item })} hitSlop={4}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={item.due_date ? dueColor(item.due_date, done) : C.border}
                  />
                </Pressable>
                <Pressable style={[s.sideBtn, s.sideBtnLast]} onPress={() => setPicker({ kind: "remind", item })} hitSlop={4}>
                  <Ionicons
                    name="alarm-outline"
                    size={18}
                    color={item.remind_at ? remindColor(item.remind_at, done) : C.border}
                  />
                </Pressable>
              </View>
            </SwipeRow>
          );
        }}
      />

      {!!undo && (
        <View style={s.toast}>
          <Text style={s.toastText} numberOfLines={1}>Выполнено: {undo.title}</Text>
          <Pressable onPress={undoComplete} hitSlop={8}>
            <Text style={s.toastAction}>Отменить</Text>
          </Pressable>
        </View>
      )}

      <DatePickerModal
        visible={picker?.kind === "due"}
        value={pickerValue}
        onChange={onPicked}
        onClose={() => setPicker(null)}
      />
      <ReminderModal
        visible={picker?.kind === "remind"}
        value={pickerValue}
        onChange={onPicked}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 10, width: "100%", maxWidth: 560, alignSelf: "center" },
  row: { flexDirection: "row", gap: 8 },
  input: { backgroundColor: C.surface, color: C.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.regular, borderWidth: 1, borderColor: C.border },
  btn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  btnText: { color: C.onAccent, fontSize: 18, fontFamily: F.bold },
  btnBusy: { opacity: 0.6 },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
  iconBtn: { width: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  iconBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  draftRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -4 },
  draftChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  draftText: { color: C.accent, fontSize: 12, fontFamily: F.medium },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  itemText: { flex: 1, gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { color: C.text, fontSize: 14, fontFamily: F.regular },
  done: { textDecorationLine: "line-through", color: C.muted },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 2 },
  metaRemind: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12, fontFamily: F.medium },
  sideBtn: { paddingHorizontal: 8, alignSelf: "stretch", justifyContent: "center" },
  sideBtnLast: { paddingRight: 14 },
  filterBtn: { alignSelf: "flex-start", backgroundColor: C.surface, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  filterText: { color: C.muted, fontSize: 12, fontFamily: F.medium },
  empty: { color: C.muted, fontSize: 14, fontFamily: F.regular, textAlign: "center", marginTop: 24 },
  // справа оставляем место под круглую кнопку-рыбку
  toast: { position: "absolute", left: 16, right: 84, bottom: 20, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.text, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  toastText: { flex: 1, color: C.bg, fontSize: 13, fontFamily: F.medium },
  toastAction: { color: C.accent, fontSize: 13, fontFamily: F.bold },
});

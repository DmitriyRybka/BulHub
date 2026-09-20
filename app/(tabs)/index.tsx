import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { router } from "expo-router";
import { api, getToken } from "../../lib/api";
import { C, F } from "../../constants/ui";
import { SafeAreaView } from "react-native-safe-area-context";

type TodoList = { id: number; name: string };
type Item = { id: number; title: string; status: "todo" | "doing" | "done" };
const NEXT = { todo: "doing", doing: "done", done: "todo" } as const;
const DOT = { todo: C.muted, doing: C.accent, done: C.good } as const;

export default function Todos() {
  const [listId, setListId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [hideDone, setHideDone] = useState(false);

  const load = useCallback(async () => {
    if (!(await getToken())) { router.replace("/login"); return; }
    const lists = await api<TodoList[]>("/todos/lists");
    if (!lists.length) return;
    setListId(lists[0].id);
    setItems(await api<Item[]>(`/todos/lists/${lists[0].id}/items`));
  }, []);

  useEffect(() => { load().catch(() => router.replace("/login")); }, [load]);

  async function add() {
    if (!title.trim() || !listId) return;
    await api(`/todos/lists/${listId}/items`, { method: "POST", body: { title } });
    setTitle("");
    setItems(await api<Item[]>(`/todos/lists/${listId}/items`));
  }

  async function toggle(item: Item) {
    await api(`/todos/items/${item.id}`, { method: "PATCH", body: { status: NEXT[item.status] } });
    setItems(await api<Item[]>(`/todos/lists/${listId}/items`));
  }

return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="Новая задача"
          placeholderTextColor={C.muted} value={title} onChangeText={setTitle} />
        <Pressable style={s.btn} onPress={add}><Text style={s.btnText}>+</Text></Pressable>
      </View>
      <Pressable style={s.filterBtn} onPress={() => setHideDone(!hideDone)}>
        <Text style={s.filterText}>{hideDone ? "Показать все" : "Скрыть выполненные"}</Text>
      </Pressable>
      <FlatList
        data={hideDone ? items.filter((i) => i.status !== "done") : items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <Pressable style={s.item} onPress={() => toggle(item)}>
            <View style={[s.dot, { backgroundColor: DOT[item.status] }]} />
            <Text style={[s.title, item.status === "done" && s.done]}>{item.title}</Text>
          </Pressable>
        )}
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
  item: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 10, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { color: C.text, flex: 1, fontSize: 14, fontFamily: F.regular },
  done: { textDecorationLine: "line-through", color: C.muted },
  filterBtn: { alignSelf: "flex-start", backgroundColor: C.surface, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  filterText: { color: C.muted, fontSize: 12, fontFamily: F.medium },
});

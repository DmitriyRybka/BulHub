import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { C, F } from "../constants/ui";
import { MonthGrid } from "./month-grid";
import { addDays, dayKey, fromKey, todayKey } from "../lib/dates";

type Props = {
  visible: boolean;
  value: string | null;             // текущая дата "YYYY-MM-DD" или null
  title?: string;
  onChange: (key: string | null) => void;
  onClose: () => void;
};

const PRESETS = [
  { label: "Сегодня", days: 0 },
  { label: "Завтра", days: 1 },
  { label: "Через неделю", days: 7 },
];

export function DatePickerModal({ visible, value, title = "Дедлайн", onChange, onClose }: Props) {
  const [month, setMonth] = useState(() => (value ? fromKey(value) : new Date()));

  // при каждом открытии показываем месяц текущего значения
  useEffect(() => {
    if (visible) setMonth(value ? fromKey(value) : new Date());
  }, [visible, value]);

  function pick(key: string | null) {
    onChange(key);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* внутренний Pressable гасит нажатие, чтобы тап по карточке её не закрывал */}
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>

          <View style={s.presets}>
            {PRESETS.map((p) => {
              const key = dayKey(addDays(fromKey(todayKey()), p.days));
              const active = key === value;
              return (
                <Pressable key={p.label} style={[s.preset, active && s.presetActive]} onPress={() => pick(key)}>
                  <Text style={[s.presetText, active && s.presetTextActive]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <MonthGrid
            compact
            month={month}
            selected={value}
            onSelect={(key) => pick(key)}
            onMonthChange={setMonth}
          />

          <View style={s.footer}>
            {value ? (
              <Pressable onPress={() => pick(null)} hitSlop={6}>
                <Text style={s.remove}>Убрать</Text>
              </Pressable>
            ) : <View />}
            <Pressable onPress={onClose} hitSlop={6}>
              <Text style={s.cancel}>Отмена</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(8, 6, 14, 0.7)",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: C.bg,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12,
  },
  title: { color: C.text, fontSize: 16, fontFamily: F.semibold },
  presets: { flexDirection: "row", gap: 6 },
  preset: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  presetActive: { backgroundColor: C.accent, borderColor: C.accent },
  presetText: { color: C.text, fontSize: 12, fontFamily: F.medium },
  presetTextActive: { color: C.onAccent, fontFamily: F.semibold },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  remove: { color: C.bad, fontSize: 14, fontFamily: F.medium },
  cancel: { color: C.muted, fontSize: 14, fontFamily: F.medium },
});

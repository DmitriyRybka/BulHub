import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../constants/ui";
import { MonthGrid } from "./month-grid";
import { addDays, dayKey, fromKey, parseUtc, timeHM, todayKey } from "../lib/dates";
import { remindersSupported } from "../lib/reminders";

type Props = {
  visible: boolean;
  value: string | null;              // remind_at с бэкенда (UTC) или null
  onChange: (iso: string | null) => void;
  onClose: () => void;
};

const QUICK_TIMES = [9, 12, 18, 21];

const at = (key: string, h: number, m: number) => {
  const d = fromKey(key);
  d.setHours(h, m, 0, 0);
  return d;
};

// По умолчанию — ближайший следующий час
function defaults(value: string | null) {
  const d = value ? parseUtc(value) : new Date(Date.now() + 60 * 60_000);
  return { day: dayKey(d), hour: d.getHours(), minute: value ? d.getMinutes() : 0 };
}

export function ReminderModal({ visible, value, onChange, onClose }: Props) {
  const [day, setDay] = useState(todayKey);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (!visible) return;
    const d = defaults(value);
    setDay(d.day);
    setHour(d.hour);
    setMinute(d.minute);
    setMonth(fromKey(d.day));
  }, [visible, value]);

  const chosen = at(day, hour, minute);
  const inPast = chosen.getTime() <= Date.now();

  function save(d: Date) {
    onChange(d.toISOString());
    onClose();
  }

  // Пресеты сохраняют сразу — это самый частый сценарий
  const now = new Date();
  const inHour = new Date(Math.ceil((now.getTime() + 60 * 60_000) / 300_000) * 300_000);
  const tonight = at(todayKey(), 19, 0);
  const tomorrowMorning = at(dayKey(addDays(now, 1)), 9, 0);
  const presets = [
    { label: "Через час", date: inHour },
    ...(tonight > now ? [{ label: "Сегодня в 19:00", date: tonight }] : []),
    { label: "Завтра в 9:00", date: tomorrowMorning },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Напоминание</Text>

            <View style={s.presets}>
              {presets.map((p) => (
                <Pressable key={p.label} style={s.preset} onPress={() => save(p.date)}>
                  <Text style={s.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <MonthGrid compact month={month} selected={day} onSelect={setDay} onMonthChange={setMonth} />

            <View style={s.timeRow}>
              <Stepper value={hour} onChange={(h) => setHour((h + 24) % 24)} />
              <Text style={s.colon}>:</Text>
              <Stepper value={minute} step={5} onChange={(m) => setMinute((m + 60) % 60)} />
            </View>
            <View style={s.quickTimes}>
              {QUICK_TIMES.map((h) => {
                const active = hour === h && minute === 0;
                return (
                  <Pressable
                    key={h}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => { setHour(h); setMinute(0); }}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{timeHM(at(day, h, 0))}</Text>
                  </Pressable>
                );
              })}
            </View>

            {inPast && <Text style={s.warn}>Это время уже прошло</Text>}
            {!remindersSupported && (
              <Text style={s.note}>В браузере уведомления не приходят — напоминание сработает на телефоне.</Text>
            )}

            <View style={s.footer}>
              {value ? (
                <Pressable onPress={() => { onChange(null); onClose(); }} hitSlop={6}>
                  <Text style={s.remove}>Убрать</Text>
                </Pressable>
              ) : <View />}
              <View style={s.footerRight}>
                <Pressable onPress={onClose} hitSlop={6}>
                  <Text style={s.cancel}>Отмена</Text>
                </Pressable>
                <Pressable style={[s.saveBtn, inPast && s.saveBtnOff]} onPress={() => save(chosen)} disabled={inPast}>
                  <Text style={s.saveText}>Сохранить</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({ value, step = 1, onChange }: { value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => onChange(value - step)} hitSlop={4}>
        <Ionicons name="remove" size={18} color={C.text} />
      </Pressable>
      <Text style={s.stepValue}>{String(value).padStart(2, "0")}</Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(value + step)} hitSlop={4}>
        <Ionicons name="add" size={18} color={C.text} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(8, 6, 14, 0.7)",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  card: {
    width: "100%", maxWidth: 360, maxHeight: "92%", backgroundColor: C.bg,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
  },
  content: { padding: 16, gap: 12 },
  title: { color: C.text, fontSize: 16, fontFamily: F.semibold },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  preset: {
    flexGrow: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, alignItems: "center",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  presetText: { color: C.text, fontSize: 12, fontFamily: F.medium },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  colon: { color: C.text, fontSize: 22, fontFamily: F.bold },
  stepper: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surface,
    borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 4,
  },
  stepBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepValue: { color: C.text, fontSize: 20, fontFamily: F.semibold, minWidth: 30, textAlign: "center" },
  quickTimes: { flexDirection: "row", gap: 6, justifyContent: "center" },
  chip: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontFamily: F.medium },
  chipTextActive: { color: C.onAccent, fontFamily: F.semibold },
  warn: { color: C.bad, fontSize: 12, fontFamily: F.regular, textAlign: "center" },
  note: { color: C.muted, fontSize: 12, fontFamily: F.regular, textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  remove: { color: C.bad, fontSize: 14, fontFamily: F.medium },
  cancel: { color: C.muted, fontSize: 14, fontFamily: F.medium },
  saveBtn: { backgroundColor: C.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  saveBtnOff: { opacity: 0.4 },
  saveText: { color: C.onAccent, fontSize: 14, fontFamily: F.semibold },
});

import { useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, BackHandler, Keyboard, StyleSheet,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../constants/ui";

// Ручка внизу экрана «Дела»: свайп вверх (или тап) открывает шторку новой задачи.
// Отдельная ручка, а не свайп по списку: вертикальный жест по списку — это прокрутка.
export function QuickAddHandle({ onOpen }: { onOpen: () => void }) {
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-15, 15])  // горизонтальное движение — не наш жест
    .onUpdate((e) => {
      "worklet";
      // ручка тянется за пальцем с сопротивлением, но недалеко
      y.set(Math.max(-28, Math.min(0, e.translationY * 0.5)));
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationY < -24 || e.velocityY < -400) scheduleOnRN(onOpen);
      y.set(withSpring(0, { damping: 18, stiffness: 260 }));
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.handleWrap, style]}>
        <Pressable style={s.handle} onPress={onOpen} accessibilityRole="button" accessibilityLabel="Новая задача">
          <Ionicons name="chevron-up" size={16} color={C.accent} />
          <Text style={s.handleText}>Новая задача</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

type SheetProps = {
  visible: boolean;
  paused: boolean;            // открыт выбор даты — не перехватываем фокус
  title: string;
  onChangeTitle: (t: string) => void;
  onSubmit: () => Promise<boolean>;
  onClose: () => void;
  busy: boolean;
  error: string;
  dueLabel: string | null;
  remindLabel: string | null;
  onPickDue: () => void;
  onPickRemind: () => void;
  onClearDue: () => void;
  onClearRemind: () => void;
};

// Не Modal, а слой поверх экрана: у Modal на Android с edge-to-edge окно не
// ужимается под клавиатуру, и шторка оказалась бы под ней. Здесь её поднимает
// KeyboardAvoidingView — он считает отступ от своей рамки, так что высоту
// панели вкладок снизу учитывать не нужно.
export function QuickAddSheet(p: SheetProps) {
  const input = useRef<TextInput>(null);

  const focusInput = () => input.current?.focus();

  // Клавиатура сразу. autoFocus на телефоне открывает её, пока шторка ещё
  // выезжает; а надёжная страховка — фокус по окончании анимации появления:
  // до её старта Reanimated держит элемент скрытым (visibility: hidden в вебе),
  // и скрытое поле фокус не принимает.
  const entering = SlideInDown.duration(220).withCallback((finished) => {
    "worklet";
    if (finished) scheduleOnRN(focusInput);
  });

  // После закрытия выбора даты возвращаем фокус в поле (и клавиатуру).
  const wasPaused = useRef(false);
  useEffect(() => {
    if (p.paused) { wasPaused.current = true; return; }
    if (!wasPaused.current || !p.visible) return;
    wasPaused.current = false;
    // даём модалке выбора даты доиграть затухание (~200–300 мс): пока её окно
    // не исчезло, Android может не показать клавиатуру для поля под ней
    const t = setTimeout(focusInput, 350);
    return () => clearTimeout(t);
  }, [p.paused, p.visible]);

  // системная «Назад» на Android закрывает шторку, а не уходит с экрана
  useEffect(() => {
    if (!p.visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      p.onClose();
      return true;
    });
    return () => sub.remove();
  }, [p.visible, p.onClose]);

  if (!p.visible) return null;

  async function submit() {
    if (await p.onSubmit()) p.onClose();
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={s.overlay}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable style={s.backdrop} onPress={p.onClose} accessibilityLabel="Закрыть" />
      </Animated.View>

      <Animated.View entering={entering} style={s.sheet}>
        <View style={s.grip} />
        <TextInput
          ref={input}
          style={s.input}
          value={p.title}
          onChangeText={p.onChangeTitle}
          placeholder="Что нужно сделать?"
          placeholderTextColor={C.muted}
          autoFocus
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
          maxLength={300}
        />

        <View style={s.row}>
          <Chip icon="calendar-outline" label={p.dueLabel ?? "Дедлайн"} active={!!p.dueLabel}
            onPress={p.onPickDue} onClear={p.dueLabel ? p.onClearDue : undefined} />
          <Chip icon="alarm-outline" label={p.remindLabel ?? "Напомнить"} active={!!p.remindLabel}
            onPress={p.onPickRemind} onClear={p.remindLabel ? p.onClearRemind : undefined} />
          <View style={{ flex: 1 }} />
          <Pressable
            style={[s.addBtn, (!p.title.trim() || p.busy) && s.addBtnOff]}
            onPress={submit}
            disabled={p.busy}
            accessibilityLabel="Добавить задачу"
          >
            <Ionicons name="arrow-up" size={20} color={C.onAccent} />
          </Pressable>
        </View>

        {!!p.error && <Text style={s.error}>{p.error}</Text>}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function Chip({ icon, label, active, onPress, onClear }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={() => { Keyboard.dismiss(); onPress(); }}>
      <Ionicons name={icon} size={14} color={active ? C.accent : C.muted} />
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{label}</Text>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Убрать">
          <Ionicons name="close" size={13} color={C.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // справа оставляем место под круглую кнопку-рыбку
  handleWrap: { position: "absolute", left: 16, right: 84, bottom: 16 },
  handle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 14, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  handleText: { color: C.text, fontSize: 14, fontFamily: F.semibold },

  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(8, 6, 14, 0.6)" },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderBottomWidth: 0, borderColor: C.border,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 10,
    width: "100%", maxWidth: 560, alignSelf: "center",
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 2 },
  input: {
    color: C.text, fontSize: 17, fontFamily: F.medium, paddingVertical: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 150,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 12, fontFamily: F.medium, flexShrink: 1 },
  chipTextActive: { color: C.accent },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  addBtnOff: { opacity: 0.4 },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
});

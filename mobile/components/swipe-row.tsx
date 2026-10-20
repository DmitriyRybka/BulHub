import { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { C, F } from "../constants/ui";

type Props = {
  children: ReactNode;
  onSwipe: () => void;   // вызывается, когда строка уехала и схлопнулась
  enabled?: boolean;
  gap?: number;          // отступ снизу — схлопывается вместе со строкой
};

const THRESHOLD = 0.33;  // доля ширины, после которой свайп засчитывается
const FLING = 900;       // или достаточно резкий бросок, px/с

// Свайп вправо: под строкой проступает зелёный фон с галочкой, после порога
// строка уезжает, схлопывается по высоте, и только потом вызывается onSwipe.
// Значения читаем через get()/set() — так их понимает React Compiler.
export function SwipeRow({ children, onSwipe, enabled = true, gap = 8 }: Props) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const x = useSharedValue(0);
  const gone = useSharedValue(0); // 0 → 1 — схлопывание

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(12)       // включаемся только при движении вправо
    .failOffsetY([-10, 10])  // вертикальное движение — это прокрутка списка
    .onUpdate((e) => {
      "worklet";
      x.set(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      "worklet";
      const w = width.get() || 400; // запасное значение, если замер ещё не пришёл
      const passed = e.translationX > w * THRESHOLD || e.velocityX > FLING;
      if (!passed) {
        x.set(withSpring(0, { damping: 20, stiffness: 240 }));
        return;
      }
      x.set(withTiming(w, { duration: 160 }, (finished) => {
        if (!finished) return;
        gone.set(withTiming(1, { duration: 180 }, (done) => {
          if (done) scheduleOnRN(onSwipe);
        }));
      }));
    });

  const wrapStyle = useAnimatedStyle(() => {
    const g = gone.get();
    if (g === 0) return { marginBottom: gap };
    const k = 1 - g;
    return { height: height.get() * k, marginBottom: gap * k, opacity: k };
  });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, 36], [0, 1], Extrapolation.CLAMP),
  }));

  // галочка «дозревает» к порогу — видно, когда можно отпускать
  const iconStyle = useAnimatedStyle(() => {
    const p = width.get() ? x.get() / (width.get() * THRESHOLD) : 0;
    return { transform: [{ scale: interpolate(p, [0, 1], [0.6, 1.15], Extrapolation.CLAMP) }] };
  });

  // Меряем обычный View, а не Animated.View: у последнего в вебе onLayout не
  // вызывается. К тому же внутренний View сохраняет свою высоту, пока внешний
  // схлопывается, — замер не перезапишется посреди анимации.
  return (
    <Animated.View style={[s.wrap, wrapStyle]}>
      <View
        onLayout={(e) => {
          width.set(e.nativeEvent.layout.width);
          height.set(e.nativeEvent.layout.height);
        }}
      >
        <Animated.View style={[s.bg, bgStyle]}>
          <Animated.View style={iconStyle}>
            <Ionicons name="checkmark-circle" size={22} color={C.onAccent} />
          </Animated.View>
          <Text style={s.bgText}>Готово</Text>
        </Animated.View>
        <GestureDetector gesture={pan} userSelect="none" touchAction="pan-y">
          <Animated.View style={rowStyle}>{children}</Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 10 },
  bg: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: C.good,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 18,
  },
  bgText: { color: C.onAccent, fontSize: 14, fontFamily: F.semibold },
});

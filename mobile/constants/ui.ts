// Общие цвета и шрифты приложения.
// Шрифт — Inter, подключается в app/_layout.tsx через useFonts.
export const C = {
  bg: "#120e1c",
  surface: "#1c1630",
  border: "#352a5c",
  text: "#ece8fa",
  muted: "#9c93bf",
  accent: "#8b7cf6",
  onAccent: "#14101f",
  good: "#5ee1d4",
  bad: "#f6799b",
} as const;

// В RN вес задаётся отдельным начертанием, а не fontWeight.
export const F = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

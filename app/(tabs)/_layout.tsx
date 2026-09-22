import { createMaterialTopTabNavigator } from "expo-router/js-top-tabs";
import { router, withLayoutContext } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Pressable, StyleSheet } from "react-native";
import { C, F } from "../../constants/ui";

const TopTabs = withLayoutContext(createMaterialTopTabNavigator().Navigator);

export default function TabLayout() {
  return (
    <View style={s.root}>
      <TopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          sceneStyle: { backgroundColor: C.bg },
          tabBarStyle: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.muted,
          tabBarIndicatorStyle: { backgroundColor: C.accent, top: 0 },
          tabBarLabelStyle: { fontSize: 11, fontFamily: F.medium, textTransform: "none" },
          tabBarShowIcon: true,
        }}
      >
        <TopTabs.Screen name="index" options={{
          title: "Дела",
          // горизонтальный жест здесь занят свайпом задач — вкладки переключаются тапом
          swipeEnabled: false,
          tabBarIcon: ({ color=C.accent }) => <Ionicons name="checkbox-outline" size={20} color={color} />,
        }} />
        <TopTabs.Screen name="calendar" options={{
          title: "Календарь",
          tabBarIcon: ({ color=C.accent }) => <Ionicons name="calendar-outline" size={20} color={color} />,
        }} />
        <TopTabs.Screen name="finance" options={{
          title: "Финансы",
          tabBarIcon: ({ color=C.accent }) => <Ionicons name="wallet-outline" size={20} color={color} />,
        }} />
      </TopTabs>

      <View style={s.fabRow}>
        <View style={s.fabCol}>
          <Pressable style={s.fab} onPress={() => router.push("/profile")} accessibilityLabel="Профиль">
            <Ionicons name="fish-outline" size={28} color={C.onAccent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // держим кнопку у правого края колонки с содержимым, а не окна
  fabRow: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center", pointerEvents: "box-none" },
  fabCol: { width: "100%", maxWidth: 560, alignItems: "flex-end", paddingRight: 16, pointerEvents: "box-none" },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
})
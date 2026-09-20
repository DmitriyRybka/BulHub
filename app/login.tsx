import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api, setToken } from "../lib/api";
import { C, F } from "../constants/ui";

type Mode = "login" | "register";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) return setError("Заполни email и пароль");
    if (mode === "register") {
      if (username.trim().length < 2) return setError("Имя — минимум 2 символа");
      if (password.length < 8) return setError("Пароль — минимум 8 символов");
    }

    setBusy(true);
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email: email.trim(), password }
          : { email: email.trim(), username: username.trim(), password };
      const r = await api<{ access_token: string }>(path, { method: "POST", body });
      await setToken(r.access_token);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.form}>
        <Text style={s.logo}>Буль-Хаб °º°</Text>

        <View style={s.tabs}>
          <Tab label="Вход" active={mode === "login"} onPress={() => switchMode("login")} />
          <Tab label="Регистрация" active={mode === "register"} onPress={() => switchMode("register")} />
        </View>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {mode === "register" && (
          <TextInput
            style={s.input}
            placeholder="Имя"
            placeholderTextColor={C.muted}
            autoCapitalize="words"
            value={username}
            onChangeText={setUsername}
          />
        )}

        <TextInput
          style={s.input}
          placeholder={mode === "register" ? "Пароль — от 8 символов" : "Пароль"}
          placeholderTextColor={C.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <Pressable style={[s.btn, busy && s.btnBusy]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={C.onAccent} />
          ) : (
            <Text style={s.btnText}>{mode === "login" ? "Войти" : "Создать аккаунт"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
  form: { width: "100%", maxWidth: 340, alignSelf: "center", gap: 10 },
  logo: {
    color: C.text,
    fontSize: 24,
    fontFamily: F.bold,
    textAlign: "center",
    marginBottom: 18,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    marginBottom: 6,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.muted, fontSize: 13, fontFamily: F.medium },
  tabTextActive: { color: C.onAccent, fontFamily: F.semibold },
  input: {
    backgroundColor: C.surface,
    color: C.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: F.regular,
    borderWidth: 1,
    borderColor: C.border,
  },
  error: { color: C.bad, fontSize: 13, fontFamily: F.regular },
  btn: {
    alignSelf: "center",
    marginTop: 8,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 36,
    minWidth: 170,
    alignItems: "center",
  },
  btnBusy: { opacity: 0.6 },
  btnText: { color: C.onAccent, fontFamily: F.semibold, fontSize: 15 },
});

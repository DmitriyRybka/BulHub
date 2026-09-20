import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API = "http://192.168.0.112:8000"; // IP твоего ноутбука в Wi-Fi
const KEY = "token";

// expo-secure-store работает только на Android/iOS/tvOS — в вебе нативного
// хранилища нет, поэтому там падает getValueWithKeyAsync. Держим токен в
// localStorage: для дев-сборки в браузере этого достаточно.
const isWeb = Platform.OS === "web";

export async function getToken(): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null; // приватный режим или статический рендер
    }
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(t: string | null) {
  if (isWeb) {
    try {
      if (t) globalThis.localStorage?.setItem(KEY, t);
      else globalThis.localStorage?.removeItem(KEY);
    } catch {
      // хранилище недоступно — токен проживёт только до перезагрузки
    }
    return;
  }
  if (t) await SecureStore.setItemAsync(KEY, t);
  else await SecureStore.deleteItemAsync(KEY);
}

// FastAPI шлёт detail либо строкой (HTTPException), либо массивом ошибок
// валидации pydantic — во втором случае собираем читаемый текст.
function errorText(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((e) => {
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null;
        const msg = e?.msg ?? "";
        return field && field !== "body" ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  return `Ошибка ${status}`;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // сюда попадаем, когда сервер не поднят или телефон не в той сети
    throw new Error(`Нет связи с сервером ${API}`);
  }
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new Error(errorText(d?.detail, res.status));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

import { Platform } from "react-native";
// Импортируем по отдельным модулям, а НЕ `from "expo-notifications"`: корень пакета
// подтягивает DevicePushTokenAutoRegistration.fx, который при импорте подписывается
// на push-токен — и в Expo Go на Android это бросает исключение, роняя весь экран.
// Эти модули проверены: до автоподписки на push они не дотягиваются.
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import { getAllScheduledNotificationsAsync } from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { cancelScheduledNotificationAsync } from "expo-notifications/build/cancelScheduledNotificationAsync";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { parseUtc } from "./dates";

// Локальные уведомления есть только на Android/iOS: в вебе expo-notifications
// их не поддерживает. Время напоминания при этом хранится на бэкенде, так что
// выставленное в браузере сработает на телефоне, когда там откроют список.
export const remindersSupported = Platform.OS !== "web";

const CHANNEL = "reminders";
const PREFIX = "todo-";

let ready: Promise<void> | null = null;

// Один раз за запуск: показывать уведомления и при открытом приложении,
// и завести канал — без канала Android не покажет запрос разрешения.
function setup(): Promise<void> {
  ready ??= (async () => {
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      await setNotificationChannelAsync(CHANNEL, {
        name: "Напоминания о задачах",
        importance: AndroidImportance.HIGH,
      });
    }
  })();
  return ready;
}

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return true; // в вебе просто сохраняем время
  await setup();
  const current = await getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await requestPermissionsAsync()).granted;
}

type Remindable = { id: number; title: string; status: string; remind_at: string | null };
type Planned = { list: number; at: number; title: string };

// Приводим запланированные уведомления этого списка в соответствие с задачами:
// будущие напоминания невыполненных задач — запланированы, остальные — отменены.
export async function syncReminders(listId: number, items: Remindable[]): Promise<void> {
  if (!remindersSupported) return;
  await setup();
  if (!(await getPermissionsAsync()).granted) return;

  const now = Date.now();
  const wanted = new Map<string, Planned>();
  for (const i of items) {
    if (!i.remind_at || i.status === "done") continue;
    const at = parseUtc(i.remind_at).getTime();
    if (at > now) wanted.set(PREFIX + i.id, { list: listId, at, title: i.title });
  }

  const have = new Map<string, Partial<Planned>>();
  for (const n of await getAllScheduledNotificationsAsync()) {
    const data = (n.content.data ?? {}) as Partial<Planned>;
    if (n.identifier.startsWith(PREFIX) && data.list === listId) have.set(n.identifier, data);
  }

  const same = (a: Partial<Planned> | undefined, b: Planned) => a?.at === b.at && a?.title === b.title;

  for (const [id, planned] of have) {
    const w = wanted.get(id);
    if (!w || !same(planned, w)) await cancelScheduledNotificationAsync(id);
  }
  for (const [id, w] of wanted) {
    if (same(have.get(id), w)) continue;
    await scheduleNotificationAsync({
      identifier: id,
      content: { title: "Напоминание", body: w.title, data: w },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: w.at, channelId: CHANNEL },
    });
  }
}

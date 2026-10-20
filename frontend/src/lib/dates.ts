// Даты в локальном времени. День везде идентифицируем ключом "YYYY-MM-DD" —
// ровно в таком виде бэкенд принимает и отдаёт due_date у задач.
// Названия месяцев заданы явно: Intl в Hermes и в браузере форматирует
// по-разному ("сент." / "сен", хвост "г."), а нам нужен одинаковый вид.

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
const WEEKDAYS_FULL = [
  "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => dayKey(new Date());

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// 6 недель по 7 дней, с понедельника той недели, где 1-е число месяца.
// Всегда 42 клетки — сетка не прыгает по высоте при листании месяцев.
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7; // пн = 0 … вс = 6
  const start = addDays(first, -shift);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// Бэкенд хранит время в UTC и отдаёт его без суффикса часового пояса —
// без "Z" JS принял бы строку за локальное время и сдвинул бы событие.
export function parseUtc(s: string): Date {
  return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(s) ? s : s + "Z");
}

export const monthTitle = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export const timeHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "Среда, 23 сентября"
export function dayTitle(key: string): string {
  const d = fromKey(key);
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

// Разница в днях между двумя ключами (b − a), без учёта перевода часов
export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

// Короткая подпись дедлайна: "Сегодня", "Завтра", "25 сен", "3 янв 2027"
export function shortDay(key: string): string {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  const d = fromKey(key);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${year}`;
}

// "Завтра, 09:00" / "25 сен, 18:30"
export const dateTimeLabel = (d: Date) => `${shortDay(dayKey(d))}, ${timeHM(d)}`;

// Подписи для оси и статистики: ключ месяца "YYYY-MM".
// Для оси нужен именительный падеж ("май"), а не родительный, как в датах ("25 мая").
const MONTHS_AXIS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  return short ? MONTHS_AXIS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

// "2026-07-06" → "с июля 2026"
export function sinceLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `с ${MONTHS_GEN[m - 1]} ${y}`;
}

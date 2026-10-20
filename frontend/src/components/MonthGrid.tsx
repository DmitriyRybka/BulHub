import { WEEKDAYS, addMonths, dayKey, monthGrid, monthTitle, sameMonth, todayKey } from "../lib/dates";

type Props = {
  month: Date;                      // любой день показываемого месяца
  selected: string;                 // ключ выбранного дня "YYYY-MM-DD"
  marks: Record<string, number>;    // сколько событий в день (точки под числом)
  onSelect: (key: string) => void;
  onMonthChange: (month: Date) => void;
};

// Сетка месяца: 6 недель с понедельника, как в мобильном приложении
export default function MonthGrid({ month, selected, marks, onSelect, onMonthChange }: Props) {
  const today = todayKey();
  const days = monthGrid(month);
  const isCurrent = sameMonth(month, new Date());

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label="Предыдущий месяц"
          onClick={() => onMonthChange(addMonths(month, -1))}>‹</button>
        <div className="cal-title">
          <strong>{monthTitle(month)}</strong>
          {!isCurrent && (
            <button type="button" className="ghost cal-today"
              onClick={() => { onMonthChange(new Date()); onSelect(today); }}>Сегодня</button>
          )}
        </div>
        <button type="button" className="cal-nav" aria-label="Следующий месяц"
          onClick={() => onMonthChange(addMonths(month, 1))}>›</button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-wd${i >= 5 ? " weekend" : ""}`}>{w}</div>
        ))}
        {days.map((d, i) => {
          const key = dayKey(d);
          const n = marks[key] ?? 0;
          const cls = [
            "cal-cell",
            d.getMonth() !== month.getMonth() ? "outside" : "",
            i % 7 >= 5 ? "weekend" : "",
            key === today ? "today" : "",
            key === selected ? "selected" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={key} type="button" className={cls}
              onClick={() => { onSelect(key); if (d.getMonth() !== month.getMonth()) onMonthChange(d); }}
              aria-label={`${d.getDate()}${n ? `, событий: ${n}` : ""}`}>
              <span className="cal-num">{d.getDate()}</span>
              <span className="cal-dots">
                {Array.from({ length: Math.min(n, 3) }, (_, j) => <i key={j} />)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

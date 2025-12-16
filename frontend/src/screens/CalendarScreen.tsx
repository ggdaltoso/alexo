import type { CalendarEvent } from '../types';

const today = new Date();
function pad(n: number) {
  return n < 10 ? '0' + n : n;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
const MOCK_EVENTS: CalendarEvent[] = Array.from({ length: 7 }).map((_, i) => {
  const d = addDays(today, i);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(9 + i)}:00`,
    title: `Event ${i + 1}`,
  };
});

export default function CalendarScreen() {
  return (
    <div
      style={{
        width: 480,
        height: 320,
        padding: 16,
        fontFamily: 'monospace',
        fontSize: 20,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
        Calendar (mock data)
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {MOCK_EVENTS.map((ev) => (
          <li key={ev.date + ev.time} style={{ marginBottom: 6 }}>
            {ev.date} {ev.time} — {ev.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type CalendarPeriod = 'month' | 'week' | 'day';

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function appointmentCalendarDates(anchor: string, period: CalendarPeriod): Date[] {
  const date = new Date(`${anchor}T12:00:00`);
  if (period === 'day') return [date];
  if (period === 'month') date.setDate(1);
  date.setDate(date.getDate() - date.getDay());
  const count = period === 'month' ? 42 : 7;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(date);
    day.setDate(day.getDate() + index);
    return day;
  });
}

export function shiftAppointmentCalendar(anchor: string, period: CalendarPeriod, direction: number): string {
  const date = new Date(`${anchor}T12:00:00`);
  if (period === 'month') {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  } else {
    date.setDate(date.getDate() + direction * (period === 'week' ? 7 : 1));
  }
  return calendarDateKey(date);
}

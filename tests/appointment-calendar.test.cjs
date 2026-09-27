const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
const source = fs.readFileSync('src/app/features/appointments/appointment-calendar.ts', 'utf8');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { appointmentCalendarDates, calendarDateKey, shiftAppointmentCalendar } = context.exports;

test('month shows six complete weeks including adjacent month dates', () => {
  const dates = appointmentCalendarDates('2026-09-27', 'month');
  assert.equal(dates.length, 42);
  assert.equal(calendarDateKey(dates[0]), '2026-08-30');
  assert.equal(calendarDateKey(dates[41]), '2026-10-10');
  assert.equal(new Set(dates.map(calendarDateKey)).size, 42);
});
test('week crosses year boundaries without losing a day', () => {
  const dates = appointmentCalendarDates('2027-01-01', 'week');
  assert.equal(dates.length, 7);
  assert.equal(calendarDateKey(dates[0]), '2026-12-27');
  assert.equal(calendarDateKey(dates[6]), '2027-01-02');
});
test('month navigation clamps end-of-month and supports leap years', () => {
  assert.equal(shiftAppointmentCalendar('2026-01-31', 'month', 1), '2026-02-28');
  assert.equal(shiftAppointmentCalendar('2028-01-31', 'month', 1), '2028-02-29');
  assert.equal(shiftAppointmentCalendar('2026-03-31', 'month', -1), '2026-02-28');
});
test('day and week navigation retain local calendar dates', () => {
  assert.equal(shiftAppointmentCalendar('2026-12-31', 'day', 1), '2027-01-01');
  assert.equal(shiftAppointmentCalendar('2026-09-27', 'week', -1), '2026-09-20');
  assert.equal(calendarDateKey(appointmentCalendarDates('2026-09-27', 'day')[0]), '2026-09-27');
});

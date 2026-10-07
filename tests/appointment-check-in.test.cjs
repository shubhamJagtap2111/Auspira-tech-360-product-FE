const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const ast = ts.createSourceFile('appointments.ts', fs.readFileSync('src/app/features/appointments/appointment-page.component.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const component = ast.statements.find(node => ts.isClassDeclaration(node));
const methods = ['saveCheckIn', 'closeCheckInDrawer', 'canCheckIn', 'canManageCheckIn', 'checkInActionLabel'];
const code = `class CheckIn { ${component.members.filter(node => methods.includes(node.name?.getText(ast))).map(node => node.getText(ast)).join('\n')} } globalThis.CheckIn = CheckIn;`;
const context = vm.createContext({ getApiErrorMessage: (_, fallback) => fallback });
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const signal = initial => { let value = initial; const read = () => value; read.set = next => value = next; read.update = change => value = change(value); return read; };
function fixture(queueId = '') {
  const page = new context.CheckIn();
  const appointment = { id: 'appointment', statusCode: 'SCHEDULED', patientName: 'Test patient', queue: null };
  Object.assign(page, {
    checkingIn: signal(false), checkInAppointment: signal(appointment), checkInDrawerOpen: signal(true),
    checkInForm: signal({ queueId, appointmentId: appointment.id }), queues: signal([]), canSubmitCheckIn: () => true,
    toast: { warning() {}, error() {}, success() {} }, upsertQueue() {}, upsertAppointment() {},
    appointmentService: {},
  });
  context.createEmptyCheckInForm = () => ({});
  return page;
}
const result = { success: true, data: { id: 'queue', tokenNumber: 'TKN-001', appointmentStatusCode: 'CHECKED_IN' } };
test('double click sends one request and closes drawer after saving flag clears', async () => {
  const page = fixture(); let calls = 0, resolve;
  page.appointmentService.createQueue = () => { calls++; return new Promise(done => resolve = done); };
  const first = page.saveCheckIn(); await page.saveCheckIn(); assert.equal(calls, 1);
  resolve(result); await first;
  assert.equal(page.checkingIn(), false); assert.equal(page.checkInDrawerOpen(), false);
});
test('already queued appointment updates instead of adding a second entry', async () => {
  const page = fixture('queue'); let updates = 0;
  page.appointmentService.createQueue = () => { throw Error('Duplicate create'); };
  page.appointmentService.updateQueue = async () => { updates++; return result; };
  await page.saveCheckIn(); assert.equal(updates, 1); assert.equal(page.checkInDrawerOpen(), false);
});
test('failed request leaves form open and allows safe retry', async () => {
  const page = fixture(); page.appointmentService.createQueue = async () => ({ success: false });
  await page.saveCheckIn(); assert.equal(page.checkInDrawerOpen(), true); assert.equal(page.checkingIn(), false);
  page.appointmentService.createQueue = async () => result;
  await page.saveCheckIn(); assert.equal(page.checkInDrawerOpen(), false);
});
test('queue existence overrides stale scheduled status and active visits cannot be edited', () => {
  const page = fixture(); const appointment = page.checkInAppointment();
  page.queues.set([{ appointmentId: appointment.id, statusCode: 'WAITING' }]);
  assert.equal(page.canCheckIn(appointment), false); assert.equal(page.canManageCheckIn(appointment), true);
  assert.equal(page.checkInActionLabel(appointment), 'Update check-in');
  for (const statusCode of ['IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) {
    assert.equal(page.canManageCheckIn({ ...appointment, statusCode }), false);
  }
  page.queues.set([{ appointmentId: appointment.id, statusCode: 'IN_CONSULTATION' }]);
  assert.equal(page.canManageCheckIn(appointment), false);
});

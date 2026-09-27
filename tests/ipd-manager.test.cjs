const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/ipd/ipd-manager-workflow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { buildIpdManagerTasks } = context.exports;
const model = (overrides = {}) => ({ admissions: [], activePatients: [], beds: [], ...overrides });
const patient = (overrides = {}) => ({ admissionId: 'stay-1', patientName: 'Patient A', statusCode: 'ADMITTED', bedNo: 'A1', activeOrders: 0, ...overrides });

test('missing bed is prioritized ahead of routine intake and cleaning', () => {
  const tasks = buildIpdManagerTasks(model({ admissions: [patient({ statusCode: 'DRAFT' })], activePatients: [patient({ bedNo: '' })], beds: [{ bedId: 'b1', bedNo: 'B1', wardName: 'General', statusCode: 'CLEANING' }] }));
  assert.equal(tasks[0].kind, 'bed');
  assert.equal(tasks.length, 3);
  assert.equal(new Set(tasks.map(task => task.key)).size, 3);
});
test('no task is manufactured for an admitted patient without pending work', () => {
  assert.equal(buildIpdManagerTasks(model({ activePatients: [patient()] })).length, 0);
});
test('available and occupied beds are never offered as cleaning tasks', () => {
  const tasks = buildIpdManagerTasks(model({ beds: ['AVAILABLE', 'OCCUPIED', 'RESERVED'].map(statusCode => ({ statusCode })) }));
  assert.equal(tasks.length, 0);
});
test('discharge and investigations remain separate actions for the same stay', () => {
  const tasks = buildIpdManagerTasks(model({ activePatients: [patient({ statusCode: 'DISCHARGE_INITIATED', activeOrders: 2 })] }));
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].kind, 'discharge');
  assert.equal(tasks[1].kind, 'lab');
});
test('unloaded workspace produces no tasks', () => assert.equal(buildIpdManagerTasks(null).length, 0));

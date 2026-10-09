const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/ipd/ipd-manager-workflow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { buildIpdManagerTasks, ipdTasksForFocus, matchesIpdPatientView, sortIpdPatients } = context.exports;
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

test('work lists distinguish bed assignment, investigations, and discharge preparation', () => {
  const stay = patient({ bedNo: '  ', activeOrders: 2, statusCode: 'DISCHARGE_INITIATED' });
  for (const view of ['all', 'needs-bed', 'investigations', 'discharge']) assert.equal(matchesIpdPatientView(stay, view), true);
  assert.equal(matchesIpdPatientView(patient(), 'discharge'), false);
  assert.equal(matchesIpdPatientView(patient(), 'investigations'), false);
  assert.equal(matchesIpdPatientView(patient(), 'needs-bed'), false);
});

test('doctor and nursing focus keep their work separate from facility cleaning', () => {
  const tasks = ['admit', 'bed', 'lab', 'discharge', 'clean'].map(kind => ({ kind }));
  assert.deepEqual(Array.from(ipdTasksForFocus(tasks, 'doctor'), task => task.kind), ['lab', 'discharge']);
  assert.deepEqual(Array.from(ipdTasksForFocus(tasks, 'nursing'), task => task.kind), ['bed', 'lab', 'discharge']);
  assert.equal(ipdTasksForFocus(tasks, 'ward').length, 5);
});

test('ward desk prioritizes missing beds while clinical focus prioritizes recorded urgency', () => {
  const stays = [patient({ admissionId: 'routine', wardName: 'General', priorityCode: 'ROUTINE', bedNo: 'A2' }), patient({ admissionId: 'urgent', wardName: 'General', priorityCode: 'URGENT', bedNo: 'A10' }), patient({ admissionId: 'unassigned', wardName: '', priorityCode: 'ROUTINE', bedNo: '' })];
  assert.equal(sortIpdPatients(stays, 'ward')[0].admissionId, 'unassigned');
  assert.equal(sortIpdPatients(stays, 'doctor')[0].admissionId, 'urgent');
  assert.equal(stays[0].admissionId, 'routine');
});

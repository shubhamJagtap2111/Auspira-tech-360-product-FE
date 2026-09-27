const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual state predicates without bootstrapping Angular or duplicating logic.
const source = fs.readFileSync('src/app/features/opd/opd-page.component.ts', 'utf8');
const ast = ts.createSourceFile('opd.ts', source, ts.ScriptTarget.Latest, true);
const names = ['normalizeCode', 'isCheckedInStatus', 'isNoShowStatus', 'isActiveConsultation', 'isActiveOrCompletedConsultation', 'isCompletedVisit', 'isWaitingVisit', 'isTerminalQueueVisit'];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const context = vm.createContext({});
vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const visit = (statusCode, consultationStatus = statusCode, queueStatus = statusCode) => ({ statusCode, consultationStatus, queue: { statusCode: queueStatus } });

test('waiting patient is eligible but not current', () => {
  const patient = visit('CHECKED_IN', 'CHECKED_IN', 'WAITING');
  assert.equal(context.isWaitingVisit(patient), true);
  assert.equal(context.isActiveConsultation(patient), false);
  assert.equal(context.isTerminalQueueVisit(patient), false);
});
test('active consultation is excluded from waiting even with stale queue status', () => {
  const patient = visit('CHECKED_IN', 'IN_PROGRESS', 'WAITING');
  assert.equal(context.isActiveOrCompletedConsultation(patient), true);
});
test('completed consultation wins over stale appointment and queue states', () => {
  const patient = visit('IN_CONSULTATION', 'COMPLETED', 'WAITING');
  assert.equal(context.isCompletedVisit(patient), true);
  assert.equal(context.isActiveConsultation(patient), false);
  assert.equal(context.isActiveOrCompletedConsultation(patient), true);
});
test('closed appointment cannot appear as current because of a stale consultation', () => {
  for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW']) {
    assert.equal(context.isActiveConsultation(visit(status, 'IN_PROGRESS')), false);
  }
});
test('status spelling is normalized', () => {
  assert.equal(context.isActiveConsultation(visit('in-consultation', 'in progress')), true);
  assert.equal(context.isNoShowStatus('No Show'), true);
});
test('fresh consultation record overrides a stale view-model status', () => {
  const patient = { ...visit('IN_CONSULTATION', 'IN_PROGRESS'), consultation: { statusCode: 'COMPLETED' } };
  assert.equal(context.isCompletedVisit(patient), true);
  assert.equal(context.isActiveConsultation(patient), false);
});

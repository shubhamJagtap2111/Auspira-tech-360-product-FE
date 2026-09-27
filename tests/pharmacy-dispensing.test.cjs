const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/pharmacy/pharmacy-dispensing.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { eligibleBatches, dispensingIssue } = context.exports;
const batch = (overrides = {}) => ({ batchId: 'b1', medicineId: 'm1', batchNumber: 'LOT-1', expiryDate: '2027-09-01', availableQuantity: 10, stockState: 'AVAILABLE', isQuarantined: false, ...overrides });
const line = (overrides = {}) => ({ prescriptionItemId: 'p1', medicineId: 'm1', batchId: 'b1', quantity: 6, ...overrides });
test('excludes expired, quarantined, empty and unrelated batches', () => {
  assert.equal(eligibleBatches([batch(), batch({ stockState: 'EXPIRED' }), batch({ isQuarantined: true }), batch({ availableQuantity: 0 }), batch({ medicineId: 'm2' })], 'm1').length, 1);
});
test('orders available stock by earliest expiry without mutating stock', () => {
  const stock = [batch(), batch({ batchId: 'b2', expiryDate: '2027-01-01' })];
  assert.equal(eligibleBatches(stock, 'm1')[0].batchId, 'b2');
  assert.equal(stock[0].batchId, 'b1');
});
test('rejects aggregate over-allocation of the same batch across medicine lines', () => {
  assert.match(dispensingIssue([line(), line({ prescriptionItemId: 'p2' })], [batch()]), /only 10/);
});
test('allows exact available stock across repeated batch lines', () => {
  assert.equal(dispensingIssue([line(), line({ prescriptionItemId: 'p2', quantity: 4 })], [batch()]), null);
});
test('explains missing stock and mapping instead of silently disabling confirmation', () => {
  assert.match(dispensingIssue([line()], []), /Receive stock/);
  assert.match(dispensingIssue([line({ medicineId: '' })], [batch()]), /Map each/);
});
test('rejects missing, zero, negative and nonfinite quantities', () => {
  for (const quantity of [null, 0, -1, NaN, Infinity]) assert.match(dispensingIssue([line({ quantity })], [batch()]), /valid quantity/);
  assert.match(dispensingIssue([], [batch()]), /no medicines/);
});

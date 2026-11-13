const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = 'src/app/features/stores/';
const read = name => fs.readFileSync(root + name, 'utf8');
const context = vm.createContext({ exports: {}, Date, Number, encodeURIComponent });
vm.runInContext(ts.transpileModule(read('stores.models.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { storeCommand, storeForms } = context.exports;

test('partial receipts submit the selected record version and normalize quantity', () => {
  const form = storeForms.find(item => item.key === 'receive');
  const values = { transferId: 'id', quantity: '2.5', reason: ' Witnessed ' };
  const command = storeCommand(form, values, [{ id: 'id', version: 4 }]);
  assert.equal(command.path, '/stores/transfers/id/actions');
  assert.equal(command.body.version, 4);
  assert.equal(command.body.quantity, 2.5);
  assert.equal(command.body.reason, 'Witnessed');
  assert.equal(command.body.transferId, undefined);
  assert.throws(() => storeCommand(form, values, []), /current record/);
  assert.throws(() => storeCommand(form, { ...values, quantity: '0' }, [{ id: 'id', version: 4 }]), /valid quantity/);
});

test('plans use the current episode revision and retain episode identity in the body', () => {
  const form = { fields: [{ key: 'episodeId', label: 'Episode' }], path: '/allied/plans', revisionField: 'episodeId' };
  const command = storeCommand(form, { episodeId: 'e' }, [{ id: 'e', revision: 0 }]);
  assert.equal(command.body.revision, 0);
  assert.equal(command.body.episodeId, 'e');
  assert.throws(() => storeCommand(form, { episodeId: 'e' }, [{ id: 'e' }]), /current episode/);
});

test('new workspaces use shared Care360 controls and responsive table patterns', () => {
  const html = read('stores-workspace.component.html');
  const css = read('stores-workspace.component.css');
  assert.match(html, /ac-dropdown/);
  assert.match(html, /table-wrap.*role="region".*tabindex="0"/);
  assert.match(html, /class="ac-table"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /<select\b|\sstyle\s*=/i);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|--ac-[\w-]+\s*:/i);
  assert.match(css, /min-height: 44px/);
});


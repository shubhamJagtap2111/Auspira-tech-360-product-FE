const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file, requireModule = () => ({})) {
  const context = vm.createContext({ exports: {}, require: requireModule, crypto, Date, Number, encodeURIComponent });
  const source = fs.readFileSync('src/app/features/stores/' + file + '.ts', 'utf8');
  vm.runInContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText, context);
  return context.exports;
}

const models = load('stores.models');
const allied = load('allied.models', () => models);
const ok = data => ({ success: true, data });
function workspace(api, mode = 'stores') {
  let branch = 'MAIN';
  const effects = [];
  const providers = {
    ApiClientService: api,
    AuthStore: { hasPermission: () => true },
    BranchContextService: { selectedBranchCode: () => branch },
    ActivatedRoute: { snapshot: { data: { workspace: mode } } }
  };
  const signal = value => {
    const getter = () => value;
    getter.set = next => { value = next; };
    return getter;
  };
  const exports = load('stores-workspace.component', name => {
    if (name === '@angular/core') return {
      Component: () => component => component, signal, computed: callback => callback,
      effect: callback => effects.push(callback), inject: type => providers[type.name]
    };
    if (name === 'rxjs') return { firstValueFrom: value => Promise.resolve(value) };
    if (name.endsWith('stores.models')) return models;
    if (name.endsWith('allied.models')) return allied;
    if (name.endsWith('workspace-presentation')) return { workspaceStateLabel: value => value, workspaceBadgeClass: value => value };
    return Object.fromEntries(Object.keys(providers).map(key => [key, { [key]: class {} }[key]]));
  });
  return {
    component: new exports.StoresWorkspaceComponent(),
    changeBranch: () => { branch = 'SECOND'; effects[0](); }
  };
}

test('stock policy accepts explicit false and signed temperature values', () => {
  const policy = models.storeForms.find(form => form.key === 'stockPolicy');
  const command = models.storeCommand(policy, {
    lotId: 'lot', controlled: false, enforceFefo: true, minimumCelsius: -5, maximumCelsius: 2,
    reference: 'Reviewed policy', reason: 'Approved storage policy'
  }, [{ id: 'lot', revision: 0 }]);
  assert.equal(command.body.controlled, false);
  assert.equal(command.body.minimumCelsius, -5);
  assert.equal(command.body.revision, 0);
});

test('nested medication actions use the medication revision and retain the correct session route', () => {
  const form = allied.alliedForms.find(form => form.key === 'medicationState');
  const command = models.storeCommand(form, {
    sessionId: 'session', medicationId: 'dose', status: 'STOPPED', reason: 'Clinician reviewed'
  }, [{ id: 'dose', version: 5 }]);
  assert.equal(command.path, '/allied/sessions/session/medications/dose/state');
  assert.equal(command.body.version, 5);
  assert.equal(command.body.sessionId, undefined);
});

test('inspected receipt uses the existing inventory request and line contract', async () => {
  const calls = [];
  const { component: c } = workspace({
    get: () => ok({}),
    post: (path, body) => { calls.push({ path, body }); return { success: false, message: 'Connection lost' }; }
  });
  c.chooseTab('purchasing');
  c.chooseAction('receiveInspected');
  c.values = { orderId: 'order', lineId: 'line', inspectionId: 'inspection', quantity: 4, notes: 'Accepted units' };
  await c.submit();
  await c.submit();
  assert.equal(calls[0].path, '/inventory/purchase-orders/order/receive');
  assert.equal(calls[0].body.lines[0].inspectionId, 'inspection');
  assert.equal(calls[0].body.lines[0].quantity, 4);
  assert.equal(calls[0].body.requestId, calls[1].body.requestId);
  assert.equal(calls[0].body.commandId, undefined);
});

test('lost stock response preserves command identity and changed quantities receive a new identity', async () => {
  const calls = [];
  const { component: c } = workspace({
    get: () => ok({}),
    post: (_, body) => { calls.push(body); return { success: false, message: 'Connection lost' }; }
  });
  c.chooseAction('issue');
  c.values = { lotId: 'lot', locationId: 'location', quantity: 2, reason: 'Witnessed issue' };
  await c.submit();
  await c.submit();
  c.values.quantity = 3;
  await c.submit();
  assert.equal(calls[0].commandId, calls[1].commandId);
  assert.notEqual(calls[1].commandId, calls[2].commandId);
});

function prescription(c) {
  c.chooseTab('medications');
  c.chooseAction('prescribe');
  c.data.set({ sessions: [{ id: 'session', version: 4 }] });
  c.values = {
    sessionId: 'session', medicineId: 'medicine', doseText: 'Prescriber-entered dose', route: 'Prescribed route',
    units: 1, dueAt: '2026-11-13T10:00', endsAt: '2026-11-13T11:00', instructions: 'Prescriber instructions'
  };
}

test('medication safety review precedes posting and override changes preserve safe retry semantics', async () => {
  const posts = [];
  const rules = [{ ruleId: 'rule', kind: 'ALLERGY', behavior: 'REQUIRE_OVERRIDE', recommendation: 'Review synthetic rule' }];
  const { component: c } = workspace({
    get: path => path.includes('medication-safety') ? ok({ rules }) : ok({}),
    post: (_, body) => { posts.push(body); return { success: false, message: 'Connection lost' }; }
  }, 'allied');
  prescription(c);
  await c.submit();
  assert.equal(posts.length, 0);
  await c.submit();
  assert.equal(posts.length, 0);
  assert.match(c.error(), /specific reason/);
  c.overrideReasons.rule = 'Reviewed specific evidence';
  await c.submit();
  await c.submit();
  assert.equal(posts[0].commandId, posts[1].commandId);
  assert.equal(posts[0].overrides[0].ruleId, 'rule');
  c.overrideReasons.rule = 'Different reviewed evidence';
  await c.submit();
  assert.notEqual(posts[1].commandId, posts[2].commandId);
});

test('branch change discards a late medication safety response and patient context', async () => {
  let complete;
  const { component: c, changeBranch } = workspace({
    get: path => path.includes('medication-safety') ? new Promise(resolve => { complete = resolve; }) : ok({}),
    post: () => { throw new Error('No medication should be posted'); }
  }, 'allied');
  prescription(c);
  const pending = c.submit();
  changeBranch();
  complete(ok({ rules: [{ ruleId: 'old', behavior: 'BLOCK' }] }));
  await pending;
  assert.equal(c.medicationSafety(), null);
  assert.deepEqual(Object.keys(c.values), []);
});

test('shared workspace markup and styling preserve the established design contracts', () => {
  const html = fs.readFileSync('src/app/features/stores/stores-workspace.component.html', 'utf8');
  const css = fs.readFileSync('src/app/features/stores/stores-workspace.component.css', 'utf8');
  assert.doesNotMatch(html, /<select\b|\sstyle\s*=/i);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|--ac-[\w-]+\s*:/i);
  assert.match(html, /aria-label="Medication safety review"/);
  assert.match(html, /role="region" tabindex="0"/);
  assert.match(css, /min-height: 44px/);
});

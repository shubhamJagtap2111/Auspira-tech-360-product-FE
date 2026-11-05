const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function workspace(api) {
  const effects = [];
  let branch = 'MAIN';
  const tokens = { ApiClientService: class ApiClientService {}, AuthStore: class AuthStore {}, BranchContextService: class BranchContextService {}, ActivatedRoute: class ActivatedRoute {} };
  const providers = {
    ApiClientService: api, AuthStore: { hasPermission: () => true },
    BranchContextService: { selectedBranchCode: () => branch },
    ActivatedRoute: { snapshot: { queryParamMap: { get: () => null } } }
  };
  const signal = value => { const read = () => value; read.set = v => { value = v; }; read.update = f => { value = f(value); }; return read; };
  const context = vm.createContext({ exports: {}, crypto, console, URLSearchParams, require: name => {
    if (name === '@angular/core') return { Component: () => type => type, signal, computed: fn => fn, effect: fn => effects.push(fn), inject: type => providers[type.name] };
    if (name === 'rxjs') return { firstValueFrom: value => Promise.resolve(value) };
    if (name.endsWith('/workspace-presentation')) {
      const presentation = vm.createContext({ exports: {} });
      vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/shared/ui/workspace-presentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, presentation);
      return presentation.exports;
    }
    return { ...tokens };
  } });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/orders/shared-orders-page.component.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText, context);
  const component = new context.exports.SharedOrdersPageComponent();
  return { component, changeBranch: code => { branch = code; effects[0](); } };
}
const ok = data => ({ success: true, data, message: '' });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('retry after a failed order response preserves the idempotency key; changed content receives a new key', async () => {
  const sent = [];
  const { component: c } = workspace({ get: () => ok([]), post: (_, body) => { sent.push(body); return { success: false, data: null, message: 'NETWORK_UNAVAILABLE' }; } });
  c.patientId = crypto.randomUUID(); c.catalogueId = crypto.randomUUID(); c.specimen = 'SPEC-A';
  await c.create(); await c.create();
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
  assert.equal(c.notice(), ''); assert.equal(c.error(), 'NETWORK_UNAVAILABLE');
  c.specimen = 'SPEC-B'; await c.create();
  assert.notEqual(sent[1].idempotencyKey, sent[2].idempotencyKey);
});

test('branch switch clears patient context and ignores a late worklist from the previous branch', async () => {
  const worklists = [];
  const w = workspace({ get: path => path.startsWith('/orders?') ? new Promise(resolve => worklists.push(resolve)) : ok([]) });
  const c = w.component; c.patientId = 'patient-a'; c.catalogueId = 'service-a'; c.specimen = 'spec-a';
  const old = c.refresh();
  w.changeBranch('SECOND');
  assert.equal(c.patientId, ''); assert.equal(c.catalogueId, ''); assert.equal(c.specimen, '');
  worklists[1](ok([{ id: 'second-order' }])); await tick();
  worklists[0](ok([{ id: 'main-order' }])); await old;
  assert.equal(c.orders()[0].id, 'second-order'); assert.equal(c.busy(), false);
});

test('rapid filter changes cannot restore the older worklist response', async () => {
  const worklists = [];
  const { component: c } = workspace({ get: path => path.startsWith('/orders?') ? new Promise(resolve => worklists.push(resolve)) : ok([]) });
  const first = c.refresh(); c.department = 'IMAGING'; const second = c.refresh();
  worklists[1](ok([{ id: 'imaging-order' }])); await second;
  worklists[0](ok([{ id: 'lab-order' }])); await first;
  assert.equal(c.orders()[0].id, 'imaging-order');
});

test('an explicitly new request clears service/specimen and does not reuse the prior request key', async () => {
  const sent = [];
  const { component: c } = workspace({ get: () => ok([]), post: (_, body) => { sent.push(body); return { success: false, data: null, message: 'RETRY' }; } });
  c.patientId = crypto.randomUUID(); c.catalogueId = crypto.randomUUID();
  await c.create(); const service = c.catalogueId; c.newRequest(); assert.equal(c.catalogueId, '');
  c.catalogueId = service; await c.create(); assert.notEqual(sent[0].idempotencyKey, sent[1].idempotencyKey);
});

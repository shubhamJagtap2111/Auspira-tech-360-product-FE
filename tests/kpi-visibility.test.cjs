const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Subject, filter, map } = require('rxjs');

function fixture(storage = new Map(), blocked = false) {
  const events = new Subject();
  const router = { events, routerState: { snapshot: { root: {} } } };
  class NavigationEnd {}
  const navigate = path => {
    router.routerState.snapshot.root = { firstChild: { routeConfig: { path } } };
    events.next(new NavigationEnd());
  };
  navigate('patients');
  const signal = initial => {
    let value = initial;
    const read = () => value;
    read.update = fn => { value = fn(value); };
    read.set = next => { value = next; };
    return read;
  };
  const document = { defaultView: { localStorage: {
    getItem: key => { if (blocked) throw Error('Storage blocked'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw Error('Storage blocked'); storage.set(key, value); }
  } } };
  const context = vm.createContext({ exports: {}, require: name => {
    if (name === '@angular/core') return { Injectable: () => value => value, Directive: () => value => value,
      Component: () => value => value, ChangeDetectionStrategy: { OnPush: 0 }, signal, computed: fn => fn,
      inject: token => token === 'router' ? router : document };
    if (name === '@angular/common') return { DOCUMENT: 'document' };
    if (name === '@angular/router') return { Router: 'router', NavigationEnd };
    if (name === 'rxjs') return { filter, map };
    if (name === '@angular/core/rxjs-interop') return { toSignal: (observable, options) => {
      const value = signal(options.initialValue); observable.subscribe(next => value.set(next)); return value;
    } };
    throw Error(name);
  } });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/shared/ui/kpi-visibility.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText, context);
  return { service: new context.exports.KpiVisibilityService(), storage, navigate };
}

test('KPI preference survives reload and stays independent between pages', () => {
  const { service, storage, navigate } = fixture();
  assert.equal(service.hidden(), true);
  service.toggle();
  assert.equal(service.hidden(), false);
  assert.equal(fixture(storage).service.hidden(), false);
  navigate('doctors');
  assert.equal(service.hidden(), true);
  navigate('patients');
  assert.equal(service.hidden(), false);
  service.toggle();
  assert.equal(fixture(storage).service.hidden(), true);
});

test('profile preferences store route patterns rather than patient identifiers', () => {
  const { service, storage, navigate } = fixture();
  navigate('patients/:patientGuid'); service.toggle();
  assert.deepEqual([...storage.keys()], ['care360.ui.kpis:/patients/:patientGuid']);
  navigate('patients'); assert.equal(service.hidden(), true);
});

test('KPI toggling still works when browser storage is unavailable', () => {
  const { service } = fixture(new Map(), true);
  assert.equal(service.hidden(), true);
  service.toggle(); assert.equal(service.hidden(), false);
  service.toggle(); assert.equal(service.hidden(), true);
});

test('only an explicit visible preference expands a page', () => {
  for (const value of ['hidden', '', 'invalid']) {
    const storage = new Map([['care360.ui.kpis:/patients', value]]);
    assert.equal(fixture(storage).service.hidden(), true);
  }
  assert.equal(fixture(new Map([['care360.ui.kpis:/patients', 'visible']])).service.hidden(), false);
});

test('dynamic KPI region removal clears its accessible control reference', () => {
  const { service } = fixture();
  const first = service.register(), second = service.register();
  assert.equal(service.controls(), `${first} ${second}`);
  service.unregister(first); assert.equal(service.controls(), second);
  service.unregister(second); assert.equal(service.controls(), '');
});

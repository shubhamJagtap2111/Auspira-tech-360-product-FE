const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/core/notifications/notification-arrival.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, context);
const Tracker = context.exports.NotificationArrivalTracker;
const item = (id, extra = {}) => ({ id, title: 'Ward update', priority: 'INFO', readAt: null, ...extra });

test('existing unread notifications establish a quiet baseline', () => {
  const tracker = new Tracker();
  assert.equal(tracker.record([item('existing')]), null);
  assert.equal(tracker.record([item('existing')]), null);
});
test('new identities alert even when the unread count stays the same', () => {
  const tracker = new Tracker();
  tracker.record([item('old')]);
  assert.equal(tracker.record([item('new'), item('old', { readAt: 'now' })]).count, 1);
  assert.equal(tracker.record([item('new')]), null);
});
test('read changes and old records returning do not trigger arrivals', () => {
  const tracker = new Tracker();
  tracker.record([item('old')]);
  tracker.record([]);
  assert.equal(tracker.record([item('old')]), null);
  assert.equal(tracker.record([item('old', { readAt: 'now' }), item('already-read', { readAt: 'now' })]), null);
});
test('batches prioritize critical alerts and subsequent events have new sequence numbers', () => {
  const tracker = new Tracker();
  tracker.record([]);
  const first = tracker.record([item('one'), item('two', { priority: 'CRITICAL', title: 'Critical result' })]);
  assert.equal(first.count, 2);
  assert.equal(first.critical, true);
  assert.equal(first.title, 'Critical result');
  assert.equal(tracker.record([item('three')]).sequence, first.sequence + 1);
});
test('branch or account reset establishes a new baseline', () => {
  const tracker = new Tracker();
  tracker.record([]);
  tracker.record([item('first-branch')]);
  tracker.reset();
  assert.equal(tracker.record([item('second-branch')]), null);
  assert.equal(tracker.record([item('new-second-branch')]).count, 1);
});

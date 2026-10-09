const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const context = { exports: {} }; vm.createContext(context);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/core/chat/staff-chat.models.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
const { mergeChatMessages, retryDelay, retryableChatFailure } = context.exports;
test('retry and poll results merge by client message identity without duplicated bubbles', () => {
  const original = [{ clientMessageId: 'same', sequence: 1, body: 'One' }];
  const merged = mergeChatMessages(original, [{ clientMessageId: 'same', sequence: 1, body: 'One', readCount: 1 }, { clientMessageId: 'next', sequence: 2, body: 'Two' }]);
  assert.equal(merged.length, 2); assert.equal(merged[0].readCount, 1); assert.equal(original[0].readCount, undefined);
});
test('out-of-order history responses are restored to conversation sequence order', () => {
  const result = mergeChatMessages([{ clientMessageId: 'three', sequence: 3 }], [{ clientMessageId: 'one', sequence: 1 }, { clientMessageId: 'two', sequence: 2 }]);
  assert.equal(result.map(message => message.sequence).join(','), '1,2,3');
});
test('a different sender cannot replace another message by reusing its client ID', () => {
  const messages = mergeChatMessages([{ senderId: 'alex', clientMessageId: 'same', sequence: 1, body: 'Original' }],
    [{ senderId: 'maya', clientMessageId: 'same', sequence: 2, body: 'Different sender' }]);
  assert.equal(messages.length, 2); assert.equal(messages[0].body, 'Original');
});
test('network failures back off with a bounded delay', () => {
  assert.equal(retryDelay(1, 0), 2000); assert.equal(retryDelay(2, 0), 4000); assert.equal(retryDelay(100, 0), 60000); assert.equal(retryDelay(100, 1), 61000);
});
test('network and overload failures retry; access and validation failures require action', () => {
  for (const status of [undefined, 0, 408, 429, 500, 503]) assert.equal(retryableChatFailure(status), true);
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(retryableChatFailure(status), false);
});

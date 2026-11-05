const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Phase 2 screens reuse the shared theme, controls and table patterns', () => {
  for (const file of ['orders/shared-orders-page.component.html','integrations/integrations-page.component.html']) {
    const html = fs.readFileSync('src/app/features/' + file, 'utf8');
    assert.doesNotMatch(html, /\sstyle\s*=/i, 'Layout belongs in the shared stylesheet.');
    assert.doesNotMatch(html, /<select\b/i, 'Use the existing shared dropdown.');
    for (const button of html.matchAll(/<button\b[^>]*>/g)) assert.match(button[0], /class="[^"]*\bac-btn\b/);
    for (const table of html.matchAll(/<table\b[^>]*>/g)) assert.match(table[0], /class="[^"]*\bac-table\b/);
    assert.match(html, /ac-workspace-head/);
    assert.match(html, /role="alert"/);
    assert.match(html, /role="status"/);
  }
  const css = fs.readFileSync('src/app/shared/styles/clinical-integration-workspace.css', 'utf8');
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i, 'Feature colours must use existing theme tokens.');
  assert.doesNotMatch(css, /--ac-[\w-]+\s*:/, 'A feature must not redefine global theme tokens.');
  assert.match(css, /var\(--ac-error-text\)/);
  assert.match(css, /var\(--ac-success-text\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
});

test('Presentation labels preserve original workflow codes and use the shared semantic badges', () => {
  const context = vm.createContext({ exports: {} });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/shared/ui/workspace-presentation.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const code = 'IN_PROGRESS';
  assert.equal(context.exports.workspaceStateLabel(code), 'In progress');
  assert.equal(code, 'IN_PROGRESS');
  assert.equal(context.exports.workspaceStateLabel('STAGED'), 'Awaiting review');
  assert.equal(context.exports.workspaceStateLabel('DEAD'), 'Needs recovery');
  assert.equal(context.exports.workspaceBadgeClass('DELIVERED'), 'ac-badge ac-badge-success');
  assert.equal(context.exports.workspaceBadgeClass('QUARANTINED'), 'ac-badge ac-badge-warning');
  assert.equal(context.exports.workspaceBadgeClass('REJECTED'), 'ac-badge ac-badge-error');
});

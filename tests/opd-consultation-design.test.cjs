const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const ast = ts.createSourceFile('opd.ts', fs.readFileSync('src/app/features/opd/opd-page.component.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['consultationStageForSection', 'examinationSystemsForSpecialty', 'appendHistoryDetails'];
const code = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const context = vm.createContext({});
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('existing recovered draft sections open the corresponding redesigned stage', () => {
  for (const section of ['snapshot', 'vitals', 'consultation', 'diagnosis', 'notes']) assert.equal(context.consultationStageForSection(section), 'assessment');
  for (const section of ['prescription', 'lab-orders', 'procedures']) assert.equal(context.consultationStageForSection(section), 'treatment');
  assert.equal(context.consultationStageForSection('follow-up'), 'follow-up');
});
test('structured history preserves free text, only includes entered findings and does not duplicate them', () => {
  const history = { presentIllness: 'Patient describes shoulder pain.', location: 'Left shoulder', associatedSymptoms: 'Fatigue', onset: '' };
  const result = context.appendHistoryDetails(history);
  assert.match(result, /^Patient describes shoulder pain\./);
  assert.match(result, /Location: Left shoulder/);
  assert.match(result, /Associated symptoms: Fatigue/);
  assert.doesNotMatch(result, /Onset:/);
  assert.equal(context.appendHistoryDetails({ ...history, presentIllness: result }), result);
});
test('specialty changes order of examination headings without documenting findings', () => {
  assert.equal(context.examinationSystemsForSpecialty('Orthopedics')[0], 'Musculoskeletal');
  assert.equal(context.examinationSystemsForSpecialty('Cardiology')[0], 'Cardiovascular');
  assert.equal(context.examinationSystemsForSpecialty('Neurology')[0], 'Neurological');
  assert.equal(context.examinationSystemsForSpecialty('Pulmonology')[0], 'Respiratory');
  assert.equal(new Set(context.examinationSystemsForSpecialty('General Medicine')).size, 5);
  assert.doesNotMatch(context.examinationSystemsForSpecialty('General Medicine').join(' '), /normal|negative|absent/i);
});

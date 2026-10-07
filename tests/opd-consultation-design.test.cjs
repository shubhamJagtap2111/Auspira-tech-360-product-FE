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

const component = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'OpdPageComponent');
const shortcutNames = ['useComplaintTemplate', 'setComplaintDuration', 'setMedicineQuickValue', 'setFollowUpReason'];
const shortcutMethods = component.members.filter(node => ts.isMethodDeclaration(node) && shortcutNames.includes(node.name.getText(ast))).map(node => node.getText(ast));
vm.runInContext(ts.transpileModule('class QuickEntryHarness {' + shortcutMethods.join('\n') + '} globalThis.QuickEntryHarness = QuickEntryHarness;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
function quickEntrySetup() {
  let form = { complaintDraft: { complaint: 'Custom symptom', duration: '4 days', severity: 'High', notes: 'Patient-specific note' }, prescriptionDraft: { duration: '2', dosage: 'Doctor-entered dose', quantity: '12', instructions: 'Existing instructions' }, followUp: { reason: '', followUpDate: '2026-10-20', notes: 'Patient-specific review' } };
  const h = new context.QuickEntryHarness();
  h.clinicalForm = () => form;
  h.clinicalForm.update = fn => { form = fn(form); };
  h.complaintSuggestionsOpen = { set: value => { h.suggestionsOpen = value; } };
  h.ensurePrescriptionEditable = () => true;
  h.markPrescriptionChanged = () => { h.changed = true; };
  return h;
}
test('complaint shortcuts preserve patient-specific duration, severity and notes', () => {
  const h = quickEntrySetup();
  h.useComplaintTemplate('Fever');
  assert.equal(h.clinicalForm().complaintDraft.complaint, 'Fever');
  assert.equal(h.clinicalForm().complaintDraft.duration, '4 days');
  assert.equal(h.clinicalForm().complaintDraft.severity, 'High');
  assert.equal(h.clinicalForm().complaintDraft.notes, 'Patient-specific note');
  assert.equal(h.suggestionsOpen, false);
  h.setComplaintDuration('1 week');
  assert.equal(h.clinicalForm().complaintDraft.complaint, 'Fever');
  assert.equal(h.clinicalForm().complaintDraft.duration, '1 week');
});
test('medicine shortcuts change only the selected field and respect issued prescription locks', () => {
  const h = quickEntrySetup();
  h.setMedicineQuickValue('duration', '7');
  assert.equal(h.clinicalForm().prescriptionDraft.duration, '7');
  assert.equal(h.clinicalForm().prescriptionDraft.dosage, 'Doctor-entered dose');
  assert.equal(h.clinicalForm().prescriptionDraft.quantity, '12');
  assert.equal(h.clinicalForm().prescriptionDraft.instructions, 'Existing instructions');
  assert.equal(h.changed, true);
  h.ensurePrescriptionEditable = () => false;
  h.setMedicineQuickValue('instructions', 'After food');
  assert.equal(h.clinicalForm().prescriptionDraft.instructions, 'Existing instructions');
});
test('review reason shortcuts preserve the date and patient-specific notes', () => {
  const h = quickEntrySetup();
  h.setFollowUpReason('Review investigations');
  assert.equal(h.clinicalForm().followUp.reason, 'Review investigations');
  assert.equal(h.clinicalForm().followUp.followUpDate, '2026-10-20');
  assert.equal(h.clinicalForm().followUp.notes, 'Patient-specific review');
});

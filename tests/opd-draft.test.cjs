const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/app/features/opd/opd-page.component.ts', 'utf8');
const ast = ts.createSourceFile('opd.ts', source, ts.ScriptTarget.Latest, true);
const component = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'OpdPageComponent');
const methods = component.members.filter(node => ts.isMethodDeclaration(node) && ['saveClinicalDraft', 'observeDraftChanges', 'completeVisit'].includes(node.name.getText(ast))).map(node => node.getText(ast));
const conflict = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'isDraftConflict').getText(ast);
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; read.update = update => { value = update(value); }; return read; };
function setup() {
  const retained = [], calls = [];
  const context = vm.createContext({ clearTimeout, setTimeout, JSON,
    isCompletedVisit: visit => visit.consultation?.statusCode === 'COMPLETED',
    composeClinicalNotes: form => form.notes,
    persistEncounterDraftState: (...args) => retained.push(args),
    getApiErrorMessage: () => 'Save failed',
    hasPrescriptionContent: () => false,
  });
  vm.runInContext(ts.transpileModule(`${conflict}\nclass Harness { ${methods.join('\n')} }\nglobalThis.Harness = Harness;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const h = new context.Harness();
  const visit = { appointment: { id: 'a', patientId: 'p' }, consultation: { id: 'c', statusCode: 'IN_PROGRESS', updatedAt: '2026-10-05T10:00:00Z' } };
  Object.assign(h, { selectedVisit: signal(visit), clinicalForm: signal({ notes: 'assessment', prescriptions: [], followUp: {} }), saving: signal(false), draftSaving: signal(false), finishing: signal(false), completionProgress: signal(''), reviewOpen: signal(false), draftConflict: signal(false), draftSaveStatus: signal(''), labTests: signal([]), draftSession: 1, lastSavedDraft: '', lastObservedDraft: '', destroyed: false,
    upsertConsultation: record => calls.push(['upsert', record]), toast: { success: () => {}, error: () => {}, warning: () => {} },
    opdService: { saveConsultationDraft: async (...args) => { calls.push(['draft', ...args]); return { success: true, data: { ...visit.consultation, updatedAt: '2026-10-05T10:01:00Z' } }; } },
    validateCompletion: () => true, pendingCompletionLabs: () => 0, activeEncounterSection: signal('consultation'),
    reviewDrugAllergies: async () => true, reviewDrugInteractions: async () => true,
    saveEncounter: async () => { calls.push(['workflow']); return null; }, sendToPharmacyOnComplete: () => false,
  });
  return { h, calls, retained };
}
test('autosave uses only the draft endpoint and sends the server revision', async () => {
  const { h, calls } = setup();
  assert.equal(await h.saveClinicalDraft(false), true);
  assert.equal(calls[0][0], 'draft');
  assert.equal(calls[0][1], 'c');
  assert.equal(calls[0][4], '2026-10-05T10:00:00Z');
  assert.equal(h.selectedVisit().consultation.updatedAt, '2026-10-05T10:01:00Z');
  assert.equal(h.draftSaveStatus(), 'Saved to server');
  assert.equal(calls.some(call => call[0] === 'workflow'), false);
});
test('typing during an in-flight autosave is preserved and stays unsaved', async () => {
  const { h } = setup();
  let resolve;
  h.opdService.saveConsultationDraft = () => new Promise(done => { resolve = done; });
  const pending = h.saveClinicalDraft(false);
  h.clinicalForm().notes = 'newer edit';
  resolve({ success: true, data: { ...h.selectedVisit().consultation, updatedAt: 'new' } });
  assert.equal(await pending, true);
  assert.equal(h.clinicalForm().notes, 'newer edit');
  assert.equal(h.draftSaveStatus(), 'Unsaved changes');
  assert.equal(JSON.parse(h.lastSavedDraft).notes, 'assessment');
});
test('a session conflict retains work and blocks subsequent saves', async () => {
  const { h, retained } = setup();
  h.opdService.saveConsultationDraft = async () => ({ success: false, statusCode: 409, errors: [], message: 'Changed elsewhere' });
  assert.equal(await h.saveClinicalDraft(false), false);
  assert.equal(h.draftConflict(), true);
  assert.equal(retained.length, 1);
  assert.equal(await h.saveClinicalDraft(true), false);
  assert.equal(h.saving(), false);
});
test('network failures retain the draft and allow a manual retry', async () => {
  const { h, retained } = setup();
  const save = h.opdService.saveConsultationDraft;
  h.opdService.saveConsultationDraft = async () => { throw new Error('offline'); };
  assert.equal(await h.saveClinicalDraft(false), false);
  assert.equal(h.draftConflict(), false);
  assert.equal(retained.length, 1);
  h.opdService.saveConsultationDraft = save;
  assert.equal(await h.saveClinicalDraft(true), true);
});
test('completion cannot bypass an allergy block', async () => {
  const { h, calls } = setup();
  h.reviewDrugAllergies = async () => false;
  await h.completeVisit();
  assert.equal(calls.length, 0);
  assert.equal(h.finishing(), false);
});
test('completion cannot bypass an interaction block or pending lab tests', async () => {
  for (const kind of ['interaction', 'labs']) {
    const { h, calls } = setup();
    if (kind === 'interaction') h.reviewDrugInteractions = async () => false;
    else h.pendingCompletionLabs = () => 1;
    await h.completeVisit();
    assert.equal(calls.length, 0);
  }
});
test('a completed visit cannot be autosaved', async () => {
  const { h, calls } = setup();
  h.selectedVisit().consultation.statusCode = 'COMPLETED';
  assert.equal(await h.saveClinicalDraft(false), false);
  assert.equal(calls.length, 0);
});

test('completion review includes examination, ordered tests, and all medicines', () => {
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['parseClinicalNoteSections', 'buildCompletionSummary', 'isMeaningfulSummaryLine'].includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
  const context = vm.createContext({});
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const summary = context.buildCompletionSummary('## Examination\n- General Examination: Findings recorded\n- Observations: -\n\n## Prescription\n' + Array.from({ length: 6 }, (_, i) => `- Medicine ${i + 1}`).join('\n') + '\n\n## Lab Orders\n- CBC | Routine');
  assert.equal(summary.sections.find(section => section.title === 'Prescription').items.length, 6);
  assert.equal(summary.sections.find(section => section.title === 'Examination').items.length, 1);
  assert.equal(summary.sections.find(section => section.title === 'Lab Orders').items[0], 'CBC | Routine');
});

test('history formats legacy notes without losing wrapped text or medicine details', () => {
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['buildHistorySections', 'isMeaningfulSummaryLine'].includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
  const context = vm.createContext({});
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const sections = context.buildHistorySections('## Vitals\n- Blood Pressure: 120/80\n- Pulse Rate: 0\n- Temperature: -\n\n## Clinical History\n- Present Illness: Symptoms described,\ncontinued on the next line\n- Family History: -\n\n## Prescription\n- Example medicine | 500 mg | Tablet | 1 tablet | Qty: 6 | Twice Daily | Oral | 3 days | After food');
  assert.equal(sections[0].kind, 'metrics');
  assert.equal(sections[0].rows.length, 2);
  assert.equal(sections[0].rows[1].value, '0');
  assert.equal(sections[1].rows[0].value, 'Symptoms described,\ncontinued on the next line');
  assert.equal(sections[2].rows[0].details.length, 8);
  assert.equal(sections[2].rows[0].value, 'Example medicine');
});

test('unstructured historical notes remain readable and every entry is retained', () => {
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['buildHistorySections', 'isMeaningfulSummaryLine'].includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
  const context = vm.createContext({});
  vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.equal(context.buildHistorySections('Legacy free text\nSecond narrative line')[0].rows[0].value, 'Legacy free text\nSecond narrative line');
  assert.equal(context.buildHistorySections('## Prescription\n' + Array.from({ length: 9 }, (_, i) => `- Medicine ${i + 1}`).join('\n'))[0].rows.length, 9);
  assert.equal(context.buildHistorySections('## Vitals\n- -').length, 0);
});


test('completion shows progress during a slow request and ignores repeated completion clicks', async () => {
  const { h } = setup();
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  let saves = 0;
  h.saveEncounter = () => { saves++; entered(); return new Promise(resolve => { release = resolve; }); };
  const completion = h.completeVisit();
  await started;
  assert.equal(h.finishing(), true);
  assert.match(h.completionProgress(), /Saving consultation findings/);
  await h.completeVisit();
  assert.equal(saves, 1);
  release(null);
  await completion;
  assert.equal(h.finishing(), false);
  assert.equal(h.completionProgress(), '');
});

test('an unexpected follow-up failure clears progress and retains the active consultation', async () => {
  const { h } = setup();
  const errors = [];
  h.toast.error = (...args) => errors.push(args);
  h.clinicalForm.update(form => ({ ...form, followUp: { followUpRequired: true } }));
  h.saveEncounter = async () => h.selectedVisit().consultation;
  h.createFollowUp = async () => { throw new Error('Follow-up unavailable'); };
  await h.completeVisit();
  assert.equal(h.finishing(), false);
  assert.equal(h.completionProgress(), '');
  assert.equal(h.selectedVisit().consultation.statusCode, 'IN_PROGRESS');
  assert.equal(errors[0][0], 'Unable to complete consultation');
});

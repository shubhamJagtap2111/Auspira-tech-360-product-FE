const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/app/features/opd/opd-page.component.ts', 'utf8');
const ast = ts.createSourceFile('opd.ts', source, ts.ScriptTarget.Latest, true);
const context = vm.createContext({ exports: {} });
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInContext(compile(fs.readFileSync('src/app/features/opd/prescription-validation.ts', 'utf8')), context);
const helpers = context.exports;
Object.assign(context, helpers);
const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'OpdPageComponent');
const names = ['validateCompletion', 'validatePrescriptionDetails', 'addPrescriptionItem', 'updateMedicineSearch', 'selectMedicineSuggestion'];
const methods = component.members.filter(n => ts.isMethodDeclaration(n) && names.includes(n.name.getText(ast))).map(n => n.getText(ast));
const functions = ast.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(ast));
const medicineForms = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'medicineForms'));
vm.runInContext(compile(medicineForms.getText(ast)), context);
vm.runInContext(compile(`${functions.join('\n')}\nclass Harness {${methods.join('\n')}}\nglobalThis.Harness = Harness;globalThis.findSuggestions = findMedicineSuggestions;`), context);
const valid = { medicineId: 'catalog-1', medicine: 'Test medicine', dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '5 Days', quantity: '10', isPrn: false, prnReason: '' };
const signal = initial => { let value = initial; const read = () => value; read.update = fn => { value = fn(value); }; read.set = next => { value = next; }; return read; };
function setup(items = [valid], draft = {}) {
  const warnings = [], h = new context.Harness();
  Object.assign(h, { clinicalForm: signal({ complaints: [{}], clinicalNotes: '', history: { presentIllness: '' }, followUp: {}, prescriptions: items.map(x => ({ ...x })), prescriptionDraft: { ...valid, ...draft } }),
    toast: { warning: (...args) => warnings.push(args) }, ensurePrescriptionEditable: () => true, markPrescriptionChanged: () => {}, jumpToConsultation: () => {}, customFrequencyMode: { set: () => {} }, medicineSuggestionsOpen: signal(false), pharmacyIntegrationEnabled: signal(true), pharmacyConfigurationError: signal(false) });
  return { h, warnings };
}
test('a catalog medicine with all required fields completes validation', () => {
  const { h, warnings } = setup();
  assert.equal(h.validateCompletion(), true);
  assert.equal(warnings.length, 0);
});
test('independent prescribing accepts an unmapped medicine for Add and completion', () => {
  const { h, warnings } = setup([], { medicineId: null, medicine: 'External medicine' });
  h.pharmacyIntegrationEnabled.set(false);
  h.addPrescriptionItem();
  assert.equal(h.clinicalForm().prescriptions.length, 1);
  assert.equal(h.clinicalForm().prescriptions[0].medicineId, null);
  assert.equal(h.validateCompletion(), true);
  assert.equal(warnings.length, 0);
});
test('independent prescribing still requires clinical details and a PRN indication', () => {
  const issues = helpers.prescriptionItemIssues({ ...valid, medicineId: null, quantity: '', frequency: 'SOS', prnReason: '' }, false);
  assert.deepEqual(Array.from(issues), ['Quantity (greater than zero)', 'As-needed indication']);
});
test('unknown integration settings block prescribing without silently relaxing validation', () => {
  const { h } = setup();
  h.pharmacyConfigurationError.set(true);
  assert.equal(h.validateCompletion(), false);
  h.addPrescriptionItem();
  assert.equal(h.clinicalForm().prescriptions.length, 1);
});
test('visible values without a catalog selection identify that exact missing field', () => {
  const { h, warnings } = setup([{ ...valid, medicineId: null }]);
  assert.equal(h.validateCompletion(), false);
  assert.match(warnings[0][1], /Medicine 1 \(Test medicine\): Catalog medicine selection/);
});
test('invalid existing row reports its medicine, row number, and only missing fields', () => {
  const { h, warnings } = setup([valid, { ...valid, medicine: 'Second medicine', quantity: '', isPrn: true, prnReason: '' }]);
  assert.equal(h.validateCompletion(), false);
  assert.match(warnings[0][1], /Medicine 2 \(Second medicine\)/);
  assert.match(warnings[0][1], /Quantity.*As-needed indication/);
  assert.doesNotMatch(warnings[0][1], /Catalog medicine selection|Dosage,/);
});
test('adding an unmapped medicine retains the editor rather than creating an invalid row', () => {
  const { h } = setup([], { medicineId: null });
  h.addPrescriptionItem();
  assert.equal(h.clinicalForm().prescriptions.length, 0);
  assert.equal(h.clinicalForm().prescriptionDraft.medicine, valid.medicine);
});
test('minor name whitespace keeps a chosen catalog ID; another name clears it', () => {
  const { h } = setup();
  h.updateMedicineSearch(' Test medicine ');
  assert.equal(h.clinicalForm().prescriptionDraft.medicineId, valid.medicineId);
  h.updateMedicineSearch('Another medicine');
  assert.equal(h.clinicalForm().prescriptionDraft.medicineId, null);
});
test('an empty catalog never offers unmapped fallback suggestions', () => {
  assert.equal(context.findSuggestions('Paracetamol', []).length, 0);
  const { h } = setup();
  h.selectMedicineSuggestion({ id: null, name: 'Unmapped fallback' });
  assert.equal(h.clinicalForm().prescriptionDraft.medicineId, valid.medicineId);
});

test('medicine suggestions use pharmacy strength and form without stock or quantity requirements', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: `medicine-${index}`, name: `Paracetamol brand ${index}`,
    strength: '500 mg', dosageForm: 'Tablet', route: 'Oral', unit: 'Strip', stockOnHand: 0 }));
  const suggestions = context.findSuggestions('para', rows);
  assert.equal(suggestions.length, 12, 'all matching pharmacy names are available');
  assert.equal(suggestions[0].strength, '500 mg');
  assert.equal(suggestions[0].form, 'Tablet', 'dosage form is read from product details rather than pack unit');
  const { h } = setup([], { dosage: 'Doctor dose', quantity: '7', duration: '3 days', route: '' });
  h.pharmacyIntegrationEnabled.set(false);
  h.selectMedicineSuggestion(suggestions[0]);
  const draft = h.clinicalForm().prescriptionDraft;
  assert.equal(draft.medicine, rows[0].name);
  assert.equal(draft.strength, '500 mg');
  assert.equal(draft.dosageForm, 'Tablet');
  assert.equal(draft.route, 'Oral', 'route comes from the pharmacy record when available');
  assert.equal(draft.quantity, '7');
  assert.equal(draft.dosage, 'Doctor dose');
  assert.equal(draft.duration, '3 days');
});

test('screenshot spelling and transposed letters find catalog medicines without changing the typed name', () => {
  const catalog = [{ id: 'para', name: 'Paracetamol', strength: '500 mg', dosageForm: 'Tablet' },
    { id: 'other', name: 'Amoxicillin', strength: '500 mg', dosageForm: 'Capsule' }];
  for (const query of ['PARACITAMO', 'paracetmaol', 'PARA', 'paraci']) {
    const results = context.findSuggestions(query, catalog);
    assert.equal(results.length, 1, query);
    assert.equal(results[0].id, 'para');
    assert.equal(results[0].name, 'Paracetamol');
  }
  const { h } = setup([], { medicineId: null });
  h.updateMedicineSearch('PARACITAMO');
  assert.equal(h.clinicalForm().prescriptionDraft.medicine, 'PARACITAMO');
  assert.equal(h.clinicalForm().prescriptionDraft.medicineId, null);
});

test('generic names are searchable and exact product matches rank before close spellings', () => {
  const catalog = [{ id: 'brand', name: 'Dolo', genericName: 'Paracetamol', strength: '650 mg', dosageForm: 'Tablet' },
    { id: 'exact', name: 'Paracetamol', strength: '500 mg', dosageForm: 'Tablet' }];
  assert.deepEqual(Array.from(context.findSuggestions('paracetamol', catalog), item => item.id), ['exact', 'brand']);
  assert.equal(context.findSuggestions('PARACITAMO', catalog).length, 2);
  assert.equal(context.findSuggestions('unrelated medicine', catalog).length, 0);
  assert.equal(context.findSuggestions('px', catalog).length, 0);
});

test('live catalog brand ORH is suggested when its stored generic name is entered', () => {
  const catalog = [{ id: 'brand', name: 'ORH', genericName: 'PARACITAMOAL', strength: '567', dosageForm: 'Tablet' }];
  assert.equal(context.findSuggestions('PARACITAMO', catalog)[0].name, 'ORH');
  assert.equal(context.findSuggestions('paracitamoal', catalog)[0].id, 'brand');
});
test('duration and quantity reject negative, range, and malformed values without stripping signs', () => {
  for (const value of ['-5', '0', '1.5 days', '5-7 days', '1 week', 'abc5']) assert.equal(helpers.parsePrescriptionDuration(value), null, value);
  assert.equal(helpers.parsePrescriptionDuration(' 5 days '), 5);
  assert.equal(helpers.parsePrescriptionDuration('5'), 5);
  for (const value of ['-10', '0', '10-20', '1.2.3', 'ten']) assert.equal(helpers.parsePrescriptionQuantity(value), null, value);
  assert.equal(helpers.parsePrescriptionQuantity('10 Tablets'), 10);
  assert.equal(helpers.parsePrescriptionQuantity('2.5 ml'), 2.5);
  assert.equal(helpers.parsePrescriptionQuantity('.5 ml'), 0.5);
});
test('as-needed frequency requires an indication even for a legacy row without a PRN checkbox', () => {
  const { h, warnings } = setup([{ ...valid, frequency: 'As Needed', isPrn: false }]);
  assert.equal(h.validateCompletion(), false);
  assert.match(warnings[0][1], /As-needed indication/);
  assert.equal(helpers.isAsNeededPrescription({ ...valid, frequency: 'SOS', isPrn: false }), true);
  assert.equal(helpers.prescriptionItemIssues({ ...valid, frequency: 'As Needed', prnReason: 'Recorded indication' }).length, 0);
});

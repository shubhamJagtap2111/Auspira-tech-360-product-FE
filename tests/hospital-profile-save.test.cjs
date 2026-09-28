const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/administration/hospital/hospital-profile-save.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const { mergeHospitalSave } = context.exports;
const profile = () => ({hospitalName:'Hospital A',contact:{email:'old@example.test',primaryPhone:'111'},branding:{logoUrl:'old.png'},settings:[{settingKey:'A',settingValue:'1'}],subscription:{planCode:'STANDARD'},rowVersion:'1',modifiedDate:'old'});
test('saving branding preserves identity, contact, subscription and settings drafts',()=>{
 const submitted=profile(),saved=profile();saved.branding.logoUrl='saved.png';
 const current=structuredClone(submitted);current.hospitalName='Hospital B';current.contact.email='new@example.test';current.subscription.planCode='NEW';current.settings[0].settingValue='2';
 const result=mergeHospitalSave(current,submitted,saved,'branding');
 assert.equal(result.hospitalName,'Hospital B');assert.equal(result.contact.email,'new@example.test');assert.equal(result.subscription.planCode,'NEW');assert.equal(result.settings[0].settingValue,'2');assert.equal(result.branding.logoUrl,'saved.png');
});
test('saving profile preserves unsaved branding and settings',()=>{
 const submitted=profile(),saved=profile();submitted.branding.logoUrl='draft.png';submitted.settings[0].settingValue='2';saved.hospitalName='Normalized name';
 const result=mergeHospitalSave(submitted,structuredClone(submitted),saved,'profile');
 assert.equal(result.hospitalName,'Normalized name');assert.equal(result.branding.logoUrl,'draft.png');assert.equal(result.settings[0].settingValue,'2');
});
test('late response preserves newer name and nested contact edits while applying normalization elsewhere',()=>{
 const submitted=profile(),saved=profile(),current=profile();current.hospitalName='Newer edit';current.contact.email='typed-during-save@example.test';saved.contact.primaryPhone='+91111';saved.rowVersion='2';
 const result=mergeHospitalSave(current,submitted,saved,'profile');
 assert.equal(result.hospitalName,'Newer edit');assert.equal(result.contact.email,'typed-during-save@example.test');assert.equal(result.contact.primaryPhone,'+91111');assert.equal(result.rowVersion,'2');assert.equal(current.contact.primaryPhone,'111');
});
test('saving settings preserves all other sections and uses returned settings',()=>{
 const submitted=profile(),saved=profile();saved.settings[0].settingValue='saved';submitted.hospitalName='Draft name';
 const result=mergeHospitalSave(submitted,structuredClone(submitted),saved,'settings');
 assert.equal(result.hospitalName,'Draft name');assert.equal(result.settings[0].settingValue,'saved');
});
test('settings edited during an in-flight save remain in the form',()=>{
 const submitted=profile(),saved=profile(),current=profile();current.settings.push({settingKey:'B',settingValue:'2'});
 assert.equal(mergeHospitalSave(current,submitted,saved,'settings').settings.length,2);
});

test('draft indicator ignores server metadata but detects unsaved sections',()=>{
 const current=profile(),saved=profile();current.rowVersion='different';current.modifiedDate='different';
 assert.equal(context.exports.hasHospitalDraft(current,saved),false);
 current.branding.logoUrl='draft.png';assert.equal(context.exports.hasHospitalDraft(current,saved),true);
});
test('draft indicator is clear until a profile has loaded',()=>{
 assert.equal(context.exports.hasHospitalDraft(null,null),false);
});

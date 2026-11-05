const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function medication(api,file='medication-workspace',type='MedicationWorkspaceComponent') {
  const effects=[];let admission='admission-A',branch='MAIN';
  const providers={ApiClientService:api,AuthStore:{hasPermission:()=>true,profile:()=>({userId:'actor-A'}),session:()=>null},BranchContextService:{selectedBranchCode:()=>branch}};
  const signal=v=>{const f=()=>v;f.set=x=>v=x;return f;};
  const context=vm.createContext({exports:{},crypto,Intl,Date,console,require:name=>{
    if(name==='@angular/core')return {Component:()=>x=>x,input:{required:()=>()=>admission},signal,output:()=>({emit:()=>{}}),effect:f=>effects.push(f),inject:t=>providers[t.name]};
    if(name==='rxjs')return {firstValueFrom:x=>Promise.resolve(x)};
    if(name.endsWith('workspace-presentation'))return {workspaceStateLabel:x=>x,workspaceBadgeClass:x=>x};
    return Object.fromEntries(Object.keys(providers).map(name=>[name,{[name]:class{}}[name]]));
  }});
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/features/inpatient-care/'+file+'.component.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,context);
  return {c:new context.exports[type](),change:()=>{admission='admission-B';branch='SECOND';effects[0]();}};
}
const ok=data=>({success:true,data,message:''});const tick=()=>new Promise(r=>setImmediate(r));
test('medication mutation retry keeps its command reference after a lost response',async()=>{
 const requests=[];const {c}=medication({get:()=>ok({}),post:(path,payload)=>{requests.push(payload);return {success:false,message:'RETRY'};}});
 c.reason='Clinician hold';await c.state({id:'m1',version:1},'ON_HOLD');await c.state({id:'m1',version:1},'ON_HOLD');
 assert.equal(requests[0].commandId,requests[1].commandId);c.reason='Changed rationale';await c.state({id:'m1',version:1},'ON_HOLD');assert.notEqual(requests[1].commandId,requests[2].commandId);
});
test('late medication data and scan values cannot cross an admission/branch switch',async()=>{
 const pending=[];const w=medication({get:()=>new Promise(r=>pending.push(r))});const c=w.c;
 c.patientScan='OLD-WRISTBAND';c.medicineScan='OLD-BATCH';c.prescription.doseText='Old admission dose';const old=c.refresh();w.change();
 assert.equal(c.patientScan,'');assert.equal(c.medicineScan,'');assert.equal(c.prescription.doseText,'');
 pending[1](ok({orders:[{id:'B'}]}));await tick();pending[0](ok({orders:[{id:'A'}]}));await old;assert.equal(c.rows('orders')[0].id,'B');
});
test('late safety rules cannot replace a newer medicine selection',async()=>{
 const pending=[];const {c}=medication({get:()=>new Promise(r=>pending.push(r))});const first=c.checkSafety('a');const second=c.checkSafety('b');
 pending[1](ok([{ruleId:'B'}]));await second;pending[0](ok([{ruleId:'A'}]));await first;assert.equal(c.safety()[0].ruleId,'B');
});
test('new inpatient screens preserve shared presentation controls and theme tokens',()=>{
 for(const name of ['inpatient-care-page','medication-workspace','clinical-chart-workspace']){const html=fs.readFileSync('src/app/features/inpatient-care/'+name+'.component.html','utf8');assert.doesNotMatch(html,/\sstyle\s*=|<select\b/i);for(const button of html.matchAll(/<button\b[^>]*>/g))assert.match(button[0],/class="[^"]*\bac-btn\b|\[class.active\]/);for(const table of html.matchAll(/<table\b[^>]*>/g))assert.match(table[0],/class="[^"]*\bac-table\b/);}
 const css=fs.readFileSync('src/app/features/inpatient-care/inpatient-care-page.component.css','utf8');assert.doesNotMatch(css,/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(|font-family\s*:/i);
});

test('clinical signing blocks unsaved edits and preserves the command reference on retry',async()=>{
 const sent=[];const {c}=medication({get:()=>ok({}),post:(path,body)=>{sent.push(body);return {success:false,message:'RETRY'};}},'clinical-chart-workspace','ClinicalChartWorkspaceComponent');
 c.selected.set({id:'note-A',status:'DRAFT',version:2,author:'actor-A'});c.body={assessment:'Changed'};c.selectedBody=JSON.stringify({assessment:'Stored'});c.reason='Attestation';await c.sign();assert.equal(sent.length,0);
 c.selectedBody=JSON.stringify(c.body);await c.sign();await c.sign();assert.equal(sent[0].commandId,sent[1].commandId);assert.equal(sent[0].version,2);
});
test('amendment editor copies signed content and retains its original reference',()=>{
 const {c}=medication({get:()=>ok({})},'clinical-chart-workspace','ClinicalChartWorkspaceComponent');const row={id:'signed-A',status:'SIGNED',kind:'SPECIALTY',templateId:'pack-v1',body:{assessment:'Original'}};c.load(row,true);c.body.assessment='Amended';assert.equal(row.body.assessment,'Original');assert.equal(c.amendsId,'signed-A');assert.equal(c.templateId,'pack-v1');assert.equal(c.selected(),null);
});
test('discharge reconciliation carries explicit decisions for reported home medicines',async()=>{
 const sent=[];const {c}=medication({post:(path,body)=>{sent.push(body);return {success:false,message:'RETRY'};}});c.data.set({reconciliations:[{id:'review-A',kind:'ADMISSION',version:1,entries:JSON.stringify([{homeEntryId:'home-A',name:'Reported home medicine'}])}],orders:[]});c.reconKind='DISCHARGE';Object.assign(c.homeDecision('home-A'),{decision:'STOP',instructions:'',reason:'Clinician reviewed'});await c.reconcile();assert.equal(sent[0].homeDecisions[0].homeEntryId,'home-A');assert.equal(sent[0].homeDecisions[0].decision,'STOP');
});

test('discharged medication workspace opens history instead of new administration',async()=>{const {c}=medication({get:()=>ok({admissionState:[{id:'admission-A',status:'DISCHARGED'}],orders:[]})});c.section='administration';await c.refresh();assert.equal(c.section,'history');assert.equal(c.closed(),true);});

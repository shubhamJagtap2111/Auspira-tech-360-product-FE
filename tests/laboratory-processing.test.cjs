const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('src/app/features/laboratory/laboratory-page.component.ts','utf8');
const ast=ts.createSourceFile('laboratory.ts',source,ts.ScriptTarget.Latest,true);
const component=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='LaboratoryPageComponent');
const names=['receiveAndProcess','start','startProcessingAndEnterResult'];
const methods=component.members.filter(n=>names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const route=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='reportBlockerTab').getText(ast);
const context=vm.createContext({});
vm.runInContext(ts.transpileModule(`class Workflow {${methods}}; ${route}; globalThis.Workflow=Workflow;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
function harness(items){
 const app=new context.Workflow();const calls=[];
 let saving=false;app.saving=()=>saving;app.saving.set=v=>saving=v;
 app.worklist=()=>items;
 app.toast={success:()=>{},error:()=>calls.push('error')};
 app.service={receive:async id=>{calls.push('receive:'+id);return {success:true}},start:async id=>{calls.push('start:'+id);return {success:true}}};
 app.refresh=async()=>calls.push('refresh');app.setActiveTab=t=>calls.push('tab:'+t);app.enterResult=async row=>calls.push('result:'+row.orderItemId);
 return {app,calls};
}
const work={sampleId:'sample-1',processingId:'processing-1',orderItemId:'item-1',statusCode:'PENDING'};
test('receipt of a single test starts processing before opening result entry',async()=>{
 const {app,calls}=harness([work]);await app.receiveAndProcess({id:'sample-1'});
 assert.deepEqual(calls,['receive:sample-1','refresh','tab:worklist','start:processing-1','refresh','result:item-1']);assert.equal(app.saving(),false);
});
test('multiple tests remain in the worklist for technician selection',async()=>{
 const {app,calls}=harness([work,{...work,processingId:'processing-2',orderItemId:'item-2'}]);await app.receiveAndProcess({id:'sample-1'});
 assert.deepEqual(calls,['receive:sample-1','refresh','tab:worklist']);
});
test('failed receipt never starts processing or opens result entry',async()=>{
 const {app,calls}=harness([work]);app.service.receive=async()=>({success:false,message:'Denied'});await app.receiveAndProcess({id:'sample-1'});
 assert.deepEqual(calls,['error']);assert.equal(app.saving(),false);
});
test('Start opens results and guards against duplicate submissions',async()=>{
 const {app,calls}=harness([work]);app.saving.set(true);await app.start(work);assert.deepEqual(calls,[]);
 app.saving.set(false);await app.start(work);assert.deepEqual(calls,['start:processing-1','refresh','result:item-1']);
});
test('failed start never opens result entry',async()=>{
 const {app,calls}=harness([work]);app.service.start=async()=>({success:false});await app.start(work);assert.deepEqual(calls,['error']);assert.equal(app.saving(),false);
});
test('reports route to the next outstanding workflow step',()=>{
 for(const statusCode of ['ORDERED','REGISTERED','SAMPLE_PENDING','RECOLLECTION_REQUIRED']) assert.equal(context.reportBlockerTab({statusCode}),'collection');
 assert.equal(context.reportBlockerTab({statusCode:'SAMPLE_COLLECTED'}),'worklist');
 assert.equal(context.reportBlockerTab({statusCode:'SAMPLE_COLLECTED',verificationCount:1}),'verification');
 assert.equal(context.reportBlockerTab({statusCode:'ORDERED',processingCount:1}),'worklist');
});

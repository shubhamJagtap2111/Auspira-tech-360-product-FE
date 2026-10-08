const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},firstValueFrom:async value=>value};vm.createContext(context);vm.runInContext(compile(fs.readFileSync('src/app/features/patients/patient-prescription-document.ts','utf8')),context);context.findSavedPrescriptionConsultation=context.exports.findSavedPrescriptionConsultation;
const ast=ts.createSourceFile('service.ts',fs.readFileSync('src/app/features/patients/patient-management.service.ts','utf8'),ts.ScriptTarget.Latest,true),cls=ast.statements.find(n=>ts.isClassDeclaration(n)),method=cls.members.find(n=>n.name?.text==='prescriptionDocument');vm.runInContext(compile('class Service {'+method.getText(ast)+'};globalThis.Service=Service;'),context);
function service(status=404,rx='rx-1'){const app=new context.Service(),calls=[];app.api={get:async path=>{calls.push(path);if(path.endsWith('/document'))throw {status};if(path.includes('/history'))return {success:true,data:[{id:'visit-1',doctorId:'doc-1',patientId:'patient-1',clinicalData:JSON.stringify({prescriptionId:rx,prescriptions:[{medicine:'Medicine A'}]}),statusCode:'COMPLETED',createdAt:'2026-10-08'}]};return {success:true,data:{fullName:'Dr. Shree',registrationNo:'REG-1',branchName:'Alpha-Moshi'}};}};return {app,calls};}
test('404 document endpoint recovers exact prescription from existing OPD history',async()=>{const {app,calls}=service();const r=await app.prescriptionDocument('patient-1','rx-1');assert.equal(r.data.id,'rx-1');assert.equal(r.data.consultationId,'visit-1');assert.equal(r.data.doctorName,'Dr. Shree');assert.equal(calls.length,3);});
test('missing prescription never substitutes another visit',async()=>{const {app}=service(404,'other-rx');await assert.rejects(()=>app.prescriptionDocument('patient-1','rx-1'),/requested prescription/);});
test('permission errors do not trigger the compatibility fallback',async()=>{const {app,calls}=service(403);await assert.rejects(()=>app.prescriptionDocument('patient-1','rx-1'));assert.equal(calls.length,1);});
test('ApiClient normalized 404 recovers the requested saved prescription',async()=>{
 const {app,calls}=service();const get=app.api.get;
 app.api.get=async path=>path.endsWith('/document')?(calls.push(path),{success:false,statusCode:404,data:null}):get(path);
 const result=await app.prescriptionDocument('patient-1','rx-1');assert.equal(result.data.id,'rx-1');assert.equal(result.data.consultationId,'visit-1');assert.equal(calls.length,3);
});
test('ApiClient normalized authorization and server failures never use history fallback',async()=>{
 for(const statusCode of [401,403,500]){const {app,calls}=service();app.api.get=async path=>{calls.push(path);return {success:false,statusCode,data:null};};
 const result=await app.prescriptionDocument('patient-1','rx-1');assert.equal(result.statusCode,statusCode);assert.equal(calls.length,1);}
});

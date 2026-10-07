const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function context(response,stored) {
  const storage=new Map(stored ? [['care360.selectedBranchCode',stored]] : []);
  const signal=value=>{const read=()=>value;read.set=next=>value=next;read.asReadonly=()=>read;return read;};
  const auth={session:()=>({tenantCode:'test'}),profile:()=>null};
  const api={get:path=>Promise.resolve(path.endsWith('/branch-context')?response:{success:true,data:{hospitalName:'Test Hospital'}})};
  const sandbox=vm.createContext({exports:{},window:{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}},require:name=>{
    if(name==='@angular/core')return {Injectable:()=>x=>x,computed:fn=>fn,signal,inject:token=>token==='api'?api:auth};
    if(name==='rxjs')return {firstValueFrom:value=>value};
    if(name.includes('auth.store'))return {AuthStore:'auth'};
    if(name.includes('api-client'))return {ApiClientService:'api'};
    throw Error(name);
  }});
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/core/context/branch-context.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,sandbox);
  return {service:new sandbox.exports.BranchContextService(),storage};
}
const branch={branchGuid:'branch-b',branchCode:'SECOND',branchName:'Second Clinic',isActive:true,isDefault:false};
test('branch staff receive only server-authorised choices and no fabricated Main Branch',async()=>{
  const {service}=context({success:true,data:{organizationAccess:false,branches:[branch]}},'MAIN');
  await service.loadBranches();assert.equal(service.branches().length,1);assert.equal(service.selectedBranchCode(),'SECOND');
  service.setSelectedBranchCode('MAIN');assert.equal(service.selectedBranchCode(),'SECOND');
  service.setSelectedBranchCode('ALL');assert.equal(service.selectedBranchCode(),'SECOND');
});
test('organisation administrators may select all branches without pretending a branch is selected',async()=>{
  const {service,storage}=context({success:true,data:{organizationAccess:true,branches:[branch]}});
  await service.loadBranches();service.setSelectedBranchCode('ALL');assert.equal(service.selectedBranchCode(),'ALL');assert.equal(service.selectedBranch(),null);assert.equal(storage.get('care360.selectedBranchCode'),'ALL');
});
test('an unauthorised saved all-branch selection is replaced with the assigned branch',async()=>{
  const {service}=context({success:true,data:{organizationAccess:false,branches:[branch]}},'ALL');
  await service.loadBranches();assert.equal(service.selectedBranchCode(),'SECOND');
});
test('context failure clears stale branch choices and selection',async()=>{
  const {service,storage}=context({success:false,data:null},'MAIN');
  await service.loadBranches();assert.equal(service.selectedBranchCode(),null);assert.equal(service.branches().length,0);assert.equal(storage.has('care360.selectedBranchCode'),false);
});

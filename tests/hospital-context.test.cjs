const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function createContext(get) {
  const api = { get };
  const auth = { session: () => ({ tenantCode: 'test', hospitalName: 'Old deployment name' }), profile: () => null };
  const store = new Map();
  const signal = value => { const fn = () => value; fn.set = next => value = next; fn.asReadonly = () => fn; return fn; };
  const context = vm.createContext({ exports: {}, window: { localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) } }, require: name => {
    if(name==='@angular/core')return { Injectable:()=>x=>x, computed:fn=>fn, signal, inject: token=>token==='api'?api:auth };
    if(name==='rxjs')return { firstValueFrom: value=>value };
    if(name.includes('auth.store'))return { AuthStore:'auth' };
    if(name.includes('api-client'))return { ApiClientService:'api' };
    throw Error(name);
  }});
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/core/context/branch-context.service.ts','utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true} }).outputText,context);
  return new context.exports.BranchContextService();
}
test('failed header refresh preserves the hospital name just saved', async()=>{
 const service=createContext(()=>Promise.reject(Error('offline')));
 service.setHospitalName('Updated Hospital');await service.refreshHospitalName();
 assert.equal(service.hospitalName(),'Updated Hospital');
});
test('a slow pre-save response cannot revert the header', async()=>{
 let resolve;const service=createContext(()=>new Promise(r=>resolve=r));
 const pending=service.refreshHospitalName();service.setHospitalName('Updated Hospital');
 resolve({success:true,data:{hospitalName:'Old Hospital'}});await pending;
 assert.equal(service.hospitalName(),'Updated Hospital');
});
test('a later successful refresh accepts saved server details', async()=>{
 const service=createContext(()=>Promise.resolve({success:true,data:{hospitalName:'Server Hospital'}}));
 service.setHospitalName('Previous Hospital');await service.refreshHospitalName();
 assert.equal(service.hospitalName(),'Server Hospital');
});

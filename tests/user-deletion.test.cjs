const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

const source=ts.createSourceFile('users.ts',fs.readFileSync('src/app/features/administration/users/user-list-page.component.ts','utf8'),ts.ScriptTarget.Latest,true);
const component=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='UserListPageComponent');
const methods=component.members.filter(n=>ts.isMethodDeclaration(n)&&['deleteUser','loadUsers'].includes(n.name.getText(source))).map(n=>n.getText(source)).join('\n');
const context=vm.createContext({});
vm.runInContext(ts.transpileModule(`class Page { ${methods} } globalThis.Page=Page;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
function signal(value){const read=()=>value;read.set=x=>value=x;read.update=fn=>value=fn(value);return read;}
const target={userGuid:'target',fullName:'Test User'};
const success={success:true,data:{succeeded:true}};
function fixture(service={}){
 const calls={deleted:0,success:0,error:0,pages:[]};
 const page=new context.Page();
 Object.assign(page,{users:signal([target]),totalCount:signal(1),pageNumber:signal(1),pageSize:signal(10),loading:signal(false),deletingUserGuid:signal(null),selectedUser:signal(null),editingUserGuid:signal(null),errorKey:signal(null),userLoadRevision:0,searchText:'',roleCode:'',statusFilter:'all',branchFilter:'',departmentFilter:'',branchContext:{selectedBranchCode:()=> 'MAIN'},t:key=>key,clearForm:()=>{},dialog:{confirm:async()=>true},toast:{success:()=>calls.success++,error:()=>calls.error++},service:{deleteUser:async()=>{calls.deleted++;return success;},searchUsers:async q=>{calls.pages.push(q.pageNumber);return {success:true,data:{items:[],totalCount:0,pageNumber:q.pageNumber,pageSize:10}};},...service}});
 return {page,calls};
}
test('deletion of the last row returns to the last available page',async()=>{
 const {page,calls}=fixture();page.totalCount.set(11);page.pageNumber.set(2);
 await page.deleteUser(target);assert.deepEqual(calls.pages,[1]);assert.equal(page.users().length,0);assert.equal(calls.success,1);assert.equal(page.deletingUserGuid(),null);
});
test('failed deletion keeps the account visible and does not show success',async()=>{
 const {page,calls}=fixture({deleteUser:async()=>({success:false,message:'Denied'})});
 await page.deleteUser(target);assert.equal(page.users().length,1);assert.equal(page.totalCount(),1);assert.equal(calls.success,0);assert.equal(calls.error,1);
});
test('cancelled confirmation sends no delete request',async()=>{
 const {page,calls}=fixture();page.dialog.confirm=async()=>false;
 await page.deleteUser(target);assert.equal(calls.deleted,0);assert.equal(page.users().length,1);assert.equal(page.deletingUserGuid(),null);
});
test('a pre-delete list response cannot restore the deleted row',async()=>{
 let resolveOld;let searches=0;
 const {page}=fixture({searchUsers:async q=>++searches===1?await new Promise(resolve=>resolveOld=resolve):{success:true,data:{items:[],totalCount:0,pageNumber:1,pageSize:10}}});
 const old=page.loadUsers();await page.deleteUser(target);
 resolveOld({success:true,data:{items:[target],totalCount:1,pageNumber:1,pageSize:10}});await old;
 assert.equal(page.users().length,0);assert.equal(page.totalCount(),0);
});
test('repeated delete clicks share one pending operation',async()=>{
 let resolveDelete;let deleted=0;
 const {page}=fixture({deleteUser:async()=>{deleted++;return await new Promise(resolve=>resolveDelete=resolve);}});
 const pending=page.deleteUser(target);await Promise.resolve();await page.deleteUser(target);
 assert.equal(deleted,1);resolveDelete(success);await pending;assert.equal(page.deletingUserGuid(),null);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('service.ts',fs.readFileSync('src/app/core/notifications/notification-inbox.service.ts','utf8'),ts.ScriptTarget.Latest,true);
const cls=source.statements.find(ts.isClassDeclaration);
const methods=cls.members.filter(n=>['fetch','refresh'].includes(n.name?.text)).map(n=>n.getText(source)).join('\n');
const context={firstValueFrom:async value=>value,URLSearchParams,Date,Error};vm.createContext(context);
const trackerContext={exports:{}};vm.createContext(trackerContext);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/core/notifications/notification-arrival.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,trackerContext);
vm.runInContext(ts.transpileModule('class Service {'+methods+'};globalThis.Service=Service;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const signal=value=>{const read=()=>value;read.set=next=>value=next;return read;};
function service(){const app=new context.Service();Object.assign(app,{unavailableUntil:0,unavailableMessage:'Notifications unavailable; retry after server update.',generation:0,refreshing:false,error:signal(''),loading:signal(false),snapshot:signal(null),arrival:signal(null),arrivalTracker:new trackerContext.exports.NotificationArrivalTracker(),auth:{isAuthenticated:()=>true}});return app;}
test('missing notification refresh route pauses polling and inbox requests',async()=>{
 const app=service();let calls=0;app.api={post:async()=>{calls++;return {success:false,statusCode:404};},get:async()=>{throw Error('must not fetch missing inbox');}};
 await app.refresh();await app.refresh();await assert.rejects(()=>app.fetch(),/server update/);
 assert.equal(calls,1);assert.match(app.error(),/server update/);assert.equal(app.loading(),false);
 // A branch change clears presentation state, but must retain the unavailable message.
 app.error.set('');await app.refresh();assert.match(app.error(),/server update/);assert.equal(calls,1);
});
test('explicit retry immediately recovers after the server is updated',async()=>{
 const app=service();app.unavailableUntil=Date.now()+300000;let calls=0;
 app.api={post:async()=>{calls++;return {success:true};},get:async()=>({success:true,data:{items:[],unreadCount:0}})};
 await app.refresh(true);assert.equal(calls,1);assert.equal(app.error(),'');assert.equal(app.snapshot().unreadCount,0);
});
test('ordinary server errors remain retryable without route cooldown',async()=>{
 const app=service();let calls=0;app.api={post:async()=>{calls++;return {success:false,statusCode:503};}};
 await app.refresh();await app.refresh();assert.equal(calls,2);assert.equal(app.unavailableUntil,0);
});
test('missing list route is also remembered without repeated requests',async()=>{
 const app=service();let calls=0;app.api={get:async()=>{calls++;return {success:false,statusCode:404};}};
 await assert.rejects(()=>app.fetch(),/server update/);await assert.rejects(()=>app.fetch(),/server update/);assert.equal(calls,1);
});
test('only successful new inbox records publish an arrival event',async()=>{
 const app=service();let items=[{id:'existing',title:'Existing update',priority:'INFO',readAt:null}];let available=true;
 app.api={post:async()=>({success:available,statusCode:available?200:503}),get:async()=>({success:true,data:{items,unreadCount:items.filter(item=>!item.readAt).length}})};
 await app.refresh();assert.equal(app.arrival(),null);
 available=false;await app.refresh();assert.equal(app.arrival(),null);
 available=true;items=[{id:'new',title:'New ward update',priority:'INFO',readAt:null},{...items[0],readAt:'now'}];
 await app.refresh();const arrival=app.arrival();assert.equal(arrival.count,1);assert.equal(arrival.title,'New ward update');
 await app.refresh();assert.equal(app.arrival(),arrival);
});

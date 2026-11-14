const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const crypto=require('node:crypto');
const signal=value=>{const read=()=>value;read.set=v=>value=v;read.update=f=>value=f(value);return read;};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function load(file){const context=vm.createContext({exports:{},URL,Blob,Uint8Array,Intl,Date,Error,console,setTimeout,crypto:crypto.webcrypto,getComputedStyle:()=>({getPropertyValue:()=> '#2563eb'}),document:{styleSheets:[],documentElement:{}},require:name=>{
 if(name==='@angular/core')return {Component:()=>v=>v,Injectable:()=>v=>v,ChangeDetectionStrategy:{OnPush:0},signal,inject:()=>({}),effect:()=>{},untracked:f=>f()};
 if(name==='qrcode')return require('qrcode');
 return {};
 }});vm.runInContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,context);return context.exports;}
const {PublicBookingPageComponent}=load('src/app/features/appointments/public-booking-page.component.ts');
const {BookingCentrePageComponent}=load('src/app/features/appointments/booking-centre-page.component.ts');
const {bookingPosterSvg}=load('src/app/features/appointments/booking-poster.ts');
function publicPage(){const page=Object.create(PublicBookingPageComponent.prototype);Object.assign(page,{profile:signal({doctors:[]}),slots:signal([]),selectedSlot:signal(null),error:signal(''),loading:signal(false),busy:signal(false),managing:signal(false),rescheduling:signal(false),holdId:signal(''),holdExpires:signal(''),challengeId:signal('challenge'),verified:signal(false),confirmation:signal(null),generation:0,destroyed:false,token:'',contactTicket:'protected-contact',challengeAttempt:'',link:'link',command:'',reservation:'',reservationSlot:'',confirmSignature:'',name:'Synthetic attendee',phone:'+919990000001',bookerName:'',relationship:'',visitType:'NEW_CONSULTATION',code:'123456',consent:true,api:{post:async()=>({})}});return page;}
function staffPage(){const page=Object.create(BookingCentrePageComponent.prototype);Object.assign(page,{board:signal(null),config:signal({}),selected:signal(null),error:signal(''),success:signal(''),busy:signal(false),loadSequence:0,pending:{hash:'',id:''}});return page;}

test('slot reservation acknowledgement-loss retry retains its original identity',async()=>{
 const p=publicPage(),calls=[];p.api.post=async(_path,body)=>{calls.push(body);if(calls.length===1)throw Error('Lost reply');return {holdId:body.holdId,expiresAt:'2099-01-01'};};
 const slot={id:'slot',startsAt:'2099-01-01'};await p.selectSlot(slot);await p.selectSlot(slot);
 assert.equal(calls[0].holdId,calls[1].holdId);assert.equal(p.holdId(),calls[0].holdId);
});
test('failed selection keeps the previous confirmed slot instead of showing a misleading new time',async()=>{
 const p=publicPage();const old={id:'old'};p.selectedSlot.set(old);p.holdId.set('old-hold');p.api.post=async()=>{throw Error('Slot unavailable');};
 await p.selectSlot({id:'new'});assert.equal(p.selectedSlot(),old);assert.equal(p.holdId(),'old-hold');
});
test('choosing another slot passes the prior hold for atomic release',async()=>{
 const p=publicPage();p.holdId.set('old');let body;p.api.post=async(_path,r)=>{body=r;return {holdId:r.holdId,expiresAt:'2099-01-01'};};
 await p.selectSlot({id:'new'});assert.equal(body.previousHoldId,'old');assert.equal(p.selectedSlot().id,'new');
});
test('a stale reservation response cannot restore a cleared selection',async()=>{
 const p=publicPage(),d=deferred();p.api.post=()=>d.promise;const work=p.selectSlot({id:'old'});p.generation++;d.resolve({holdId:'stale',expiresAt:'2099-01-01'});await work;
 assert.equal(p.holdId(),'');assert.equal(p.selectedSlot(),null);
});
test('verification retries preserve a cryptographically random proof token',async()=>{
 const p=publicPage(),calls=[];p.api.post=async(_path,r)=>{calls.push(r);if(calls.length===1)throw Error('Lost verification acknowledgement');return {verificationToken:r.verificationToken};};
 await p.verify();await p.verify();assert.match(calls[0].verificationToken,/^[0-9a-f]{64}$/);assert.equal(calls[0].verificationToken,calls[1].verificationToken);assert.equal(p.verified(),true);
});
test('confirmation retry retains identity and includes the verified contact ticket',async()=>{
 const p=publicPage(),calls=[];p.token='proof';p.holdId.set('hold');p.api.post=async(_path,r)=>{calls.push(r);if(calls.length===1)throw Error('Lost confirmation');return {id:'appointment'};};
 await p.confirm();await p.confirm();assert.equal(calls[0].commandId,calls[1].commandId);assert.equal(calls[0].contactTicket,'protected-contact');assert.equal(p.confirmation().id,'appointment');
});
test('editing confirmation details changes the command identity',async()=>{
 const p=publicPage(),calls=[];p.api.post=async(_path,r)=>{calls.push(r);throw Error('Validation failed');};await p.confirm();p.name='Corrected attendee';await p.confirm();assert.notEqual(calls[0].commandId,calls[1].commandId);
});
test('requesting verification after a lost response does not enqueue a second code',async()=>{
 const p=publicPage(),calls=[];p.api.post=async(_path,r)=>{calls.push(r);if(calls.length===1)throw Error('Lost response');return {challengeId:r.challengeId,contactTicket:'ticket'};};
 await p.requestCode();await p.requestCode();assert.equal(calls[0].challengeId,calls[1].challengeId);assert.equal(calls[0].messagingConsent,true);assert.equal(p.contactTicket,'ticket');
});
test('changing booking mode discards private verification credentials',()=>{
 const p=publicPage();p.token='private';p.verified.set(true);p.changeMode(true);assert.equal(p.token,'');assert.equal(p.contactTicket,'');assert.equal(p.challengeId(),'');assert.equal(p.verified(),false);
});
test('a slower old branch load cannot overwrite a newer booking board',async()=>{
 const p=staffPage();let branch='MAIN';p.branch={selectedBranchCode:()=>branch};const old=deferred();p.api={get:path=>path==='/booking'?(branch==='MAIN'?old.promise:Promise.resolve({branch:'SECOND'})):Promise.resolve({enabled:false})};
 const first=p.load();branch='SECOND';await p.load();old.resolve({branch:'MAIN'});await first;assert.equal(p.board().branch,'SECOND');assert.equal(p.busy(),false);
});
test('a booking mutation finishing after branch change cannot replace that branch board',async()=>{
 const p=staffPage(),d=deferred();let branch='MAIN';p.branch={selectedBranchCode:()=>branch};p.api={post:()=>d.promise,get:async()=>{throw Error('Should not reload the old action');}};
 const first=p.mutate('/booking/links',{title:'Test'},'Saved');branch='SECOND';p.board.set({branch:'SECOND'});d.resolve({id:'test'});await first;assert.equal(p.board().branch,'SECOND');assert.equal(p.success(),'');
});
test('poster exports escape hospital text while keeping a real vector QR and clear print background',async()=>{
 const svg=await bookingPosterSvg({title:'Doctor <script>alert(1)</script>',hospitalName:'A & B Hospital',address:'Reference address',phone:'+919990000001',url:'https://booking.fixture.invalid/book/123',format:'A4',logo:'data:image/png;base64,AA=='});
 assert.ok(svg.includes('A &amp; B Hospital'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('width="1000" height="1414"'));assert.ok(svg.includes('<svg x="220" y="350"'));assert.ok(svg.includes('fill="white"'));
});

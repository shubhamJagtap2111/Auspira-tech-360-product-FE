const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.ADMIN_BASE_URL||'http://127.0.0.1:4200';
const permissions=[...new Set([...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(m=>m[1]).concat(['Administration.UserManagement.Create','Administration.UserManagement.Edit','Administration.UserManagement.AssignRoles','Administration.Roles.Create','Administration.Roles.Edit','Administration.Roles.AssignPermissions','Administration.Department.Create','Administration.Department.Edit','Administration.Department.AssignHead','Administration.Branch.Create','Administration.Branch.Edit','Administration.Hospital.Edit','Administration.Hospital.Branding']))];
const session={userId:'test-admin',email:'admin@example.test',fullName:'Hospital Administrator',roleCodes:['HOSPITAL_ADMIN'],permissions,accessToken:'fixture',refreshToken:'fixture',accessTokenExpiresAt:'2099-01-01T00:00:00Z',tenantCode:'test',hospitalName:'Auspira City Hospital',menuItems:[]};
const address={addressLine1:'Hospital Road',addressLine2:'',cityName:'Pune',stateName:'Maharashtra',countryCode:'IN',postalCode:'411001',latitude:null,longitude:null};
const contact={primaryPhone:'020 4000 1234',secondaryPhone:'',emergencyPhone:'108',email:'care@example.test',fax:''};
const branch={branchGuid:'11111111-1111-1111-1111-111111111111',hospitalGuid:'22222222-2222-2222-2222-222222222222',branchCode:'MAIN',branchName:'Pune Main Hospital',branchTypeCode:'GENERAL',isDefault:true,isActive:true,address,contact,workingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,openTime:'09:00',closeTime:'18:00',isClosed:dayOfWeek===0,isActive:true,notes:''})),configuration:[],rowVersion:'1'};
const second={...branch,branchGuid:'33333333-3333-3333-3333-333333333333',branchCode:'SECOND',branchName:'Baner Clinic',isDefault:false};
const user={...session,userGuid:'44444444-4444-4444-4444-444444444444',email:'doctor@example.test',fullName:'Dr Ananya Rao',roleCodes:['DOCTOR'],mobileNo:'9876543210',branchCode:'MAIN',branchNameKey:'Pune Main Hospital',departmentCode:'MED',departmentNameKey:'General Medicine',languageCode:'en-US',timeZoneCode:'Asia/Kolkata',isActive:true,isEmailVerified:true,lastLoginDate:'2026-10-07T09:00:00Z',rowVersion:'1',failedLoginCount:0};
const department={departmentGuid:'55555555-5555-5555-5555-555555555555',branchGuid:branch.branchGuid,branchCode:'MAIN',branchName:branch.branchName,departmentCode:'MED',departmentName:'General Medicine',departmentHeadUserGuid:user.userGuid,departmentHeadName:user.fullName,descriptionKey:'Outpatient and general medical care',sortOrder:1,isActive:true,rowVersion:'1'};
const role={roleCode:'DOCTOR',roleNameKey:'Doctor',roleDescriptionKey:'Clinical assessment and patient care',isSystemRole:true,sortOrder:1,isActive:true,parentRoleCode:null,permissionCount:3,userCount:1,rowVersion:'1',permissionCodes:['Patients.View','OPD.View','OPD.Manage']};
const hospital={hospitalGuid:branch.hospitalGuid,hospitalCode:'AUSPIRA',hospitalName:'Auspira City Hospital',legalName:'Auspira Healthcare',shortName:'Auspira',websiteUrl:'https://example.test',establishedDate:'2020-01-01',primaryLanguageCode:'en-US',timeZoneCode:'Asia/Kolkata',currencyCode:'INR',address,contact,license:{licenseNumber:'MH-2026-001',licenseType:'Hospital',issuingAuthority:'Local authority',validFrom:'2026-01-01',validTo:'2027-01-01',documentUrl:null},gst:{gstin:null,legalBusinessName:null,registrationState:null,registrationDate:null},branding:{logoUrl:null,primaryColor:'#2563eb',secondaryColor:'#7c3aed',accentColor:'#14b8a6'},subscription:{planCode:'STANDARD',planNameKey:'Standard',statusCode:'ACTIVE',startDate:'2026-01-01',endDate:'2027-01-01',maxUsers:50,maxBranches:5},settings:[],isActive:true,rowVersion:'1'};
const catalog=['Patients.View','OPD.View','OPD.Manage','Billing.View'].map(code=>({categoryCode:'CLINICAL',categoryNameKey:'Clinical',groupCode:code.split('.')[0],groupNameKey:code.split('.')[0],menuCode:code.split('.')[0],menuNameKey:code.split('.')[0],permissionCode:code,permissionNameKey:code,actionCode:code.split('.')[1],permissionTypeCode:'ACTION',dataScopeCode:'BRANCH'}));
session.permissions.push('Inventory.Create','Inventory.Edit');
const output=path.resolve('artifacts/inventory');fs.mkdirSync(output,{recursive:true});
let workspace={items:[{id:'item-1',branch:'MAIN',name:'Examination gloves',category:'CONSUMABLE',unit:'Box',onHand:20,reorderLevel:25,unitCost:100,active:true}],vendors:[{id:'vendor-1',branch:'MAIN',name:'City Medical Supplies',phone:'9999999999',email:'supplier@example.test',address:'Pune',gstin:'',active:true}],assets:[{id:'asset-1',branch:'MAIN',number:'EQ-001',name:'ECG machine',category:'EQUIPMENT',status:'IN_SERVICE',location:'OPD',serial:'SN-001',maintenanceDue:'2026-10-01',notes:''}],orders:[],movements:[],departments:[{id:'department-1',name:'Outpatient department'}]};
let mutationCount=0;let failMove=false;let failLoad=false;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(s=>{localStorage.setItem('care360.auth.session',JSON.stringify(s));localStorage.setItem('care360.selectedBranchCode','MAIN');},session);
  await page.route('**/*',async route=>{
   const p=new URL(route.request().url()).pathname;if(!p.includes('/api/'))return route.continue();
   let data=[];let status=200;const method=route.request().method();
   if(p.endsWith('/auth/me'))data=session;
   else if(p.endsWith('/administration/branch-context'))data={organizationAccess:true,branches:[branch,second]};
   else if(p.endsWith('/administration/hospital'))data=hospital;
   else if(p.endsWith('/inventory/workspace')){data=workspace;if(failLoad){status=503;data=null;}}
   else if(p.includes('/inventory/')&&method!=='GET'){
    mutationCount++;const r=route.request().postDataJSON();data={id:'new-'+mutationCount};
    if(p.endsWith('/items'))workspace.items.push({...r,id:data.id,branch:'MAIN',onHand:0});
    if(p.endsWith('/vendors'))workspace.vendors.push({...r,id:data.id,branch:'MAIN'});
    if(p.endsWith('/assets'))workspace.assets.push({...r,id:data.id,branch:'MAIN'});
    if(p.endsWith('/purchase-orders'))workspace.orders.push({...r,id:data.id,number:'PO-20261007-TEST',branch:'MAIN',vendor:workspace.vendors.find(v=>v.id===r.vendorId).name,total:r.lines.reduce((s,l)=>s+l.quantity*l.rate,0),status:'DRAFT',createdAt:new Date().toISOString(),lines:r.lines.map((l,n)=>({...l,id:'line-'+n,name:workspace.items.find(i=>i.id===l.itemId).name,unit:'Box',received:0}))});
    if(p.endsWith('/status'))workspace.orders[0].status=r.status;
    if(p.endsWith('/receive')){for(const l of r.lines){workspace.orders[0].lines.find(x=>x.id===l.lineId).received+=l.quantity;workspace.items[0].onHand+=l.quantity;}workspace.orders[0].status='PARTIALLY_RECEIVED';}
    if(p.endsWith('/stock-movements')){
     if(failMove){status=409;data=null;}else{workspace.items[0].onHand-=r.quantity;workspace.movements.unshift({id:r.requestId,branch:'MAIN',item:workspace.items[0].name,unit:'Box',type:r.type,quantity:-r.quantity,balance:workspace.items[0].onHand,reference:r.reference,notes:r.notes,department:'Outpatient department',actor:'Stores Administrator',createdAt:new Date().toISOString()});}
     await new Promise(resolve=>setTimeout(resolve,400));
    }
   }
   if(p.includes('/localization/catalog'))data={resources:{},languages:[],seedData:{},version:1,cultureCode:'en-US'};
   await route.fulfill({status,json:{success:status===200,statusCode:status,data,message:status===200?'Fixture':'Insufficient stock. Refresh the current balance and reduce the quantity.',errors:[]}});
  });
  const main=page.locator('main');
  for(const width of [360,768,1366,1920]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/inventory');await main.getByRole('heading',{name:'Inventory',exact:true}).waitFor();await page.waitForTimeout(400);
   for(const name of ['Overview','Items & stock','Purchase orders','Equipment & assets','Vendors','Stock ledger']){
    await main.getByRole('button',{name,exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name} fits ${width}`);
   }
   await main.getByRole('button',{name:'Overview',exact:true}).click();await page.screenshot({path:path.join(output,`overview-${width}.png`)});
   await main.getByRole('button',{name:'New item',exact:false}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
   assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`drawer fits ${width}`);
   await page.screenshot({path:path.join(output,`item-form-${width}.png`)});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  }
  await page.setViewportSize({width:1366,height:900});
  await main.getByRole('button',{name:'New item',exact:false}).click();
  await page.getByRole('textbox',{name:'Item name'}).fill('Sterile gauze');
  await page.getByRole('button',{name:'Save record',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await main.getByRole('button',{name:'Items & stock',exact:true}).click();await main.getByText('Sterile gauze',{exact:true}).waitFor();
  await main.getByRole('button',{name:'Purchase orders',exact:true}).click();await main.getByRole('button',{name:'New order',exact:false}).click();
  await page.getByRole('combobox',{name:'Vendor',exact:false}).selectOption('vendor-1');await page.getByRole('combobox',{name:'Stock item',exact:false}).selectOption('item-1');
  await page.getByRole('spinbutton',{name:'Quantity',exact:false}).fill('10');await page.getByRole('button',{name:'Save draft order',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await main.getByRole('button',{name:'Approve order',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Approve order',exact:true}).click();await main.getByRole('button',{name:'Receive stock',exact:true}).waitFor();
  await main.getByRole('button',{name:'Receive stock',exact:true}).click();await page.getByRole('spinbutton',{name:'Received',exact:false}).fill('4');await page.getByRole('button',{name:'Confirm receipt',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await main.locator('.badge').filter({hasText:'Partially received'}).waitFor();assert.equal(workspace.items[0].onHand,24);
  await main.getByRole('button',{name:'Items & stock',exact:true}).click();await main.getByRole('button',{name:'Stock movement',exact:true}).click();
  await page.getByRole('combobox',{name:'Stock item',exact:false}).selectOption('item-1');await page.getByRole('spinbutton',{name:'Quantity',exact:false}).fill('2');await page.getByRole('combobox',{name:'Department',exact:true}).selectOption('department-1');await page.getByRole('textbox',{name:'Reference / reason',exact:false}).fill('OPD daily supplies');
  const before=mutationCount;await page.getByRole('button',{name:'Record movement',exact:true}).click();assert(await page.getByRole('button',{name:'Saving…',exact:true}).isDisabled());await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(mutationCount,before+1);assert.equal(workspace.items[0].onHand,22);
  await main.getByRole('button',{name:'Stock ledger',exact:true}).click();await main.locator('td').filter({hasText:'OPD daily supplies'}).waitFor();
  await main.getByRole('button',{name:'Items & stock',exact:true}).click();await main.getByRole('button',{name:'Stock movement',exact:true}).click();await page.getByRole('combobox',{name:'Stock item',exact:false}).selectOption('item-1');await page.getByRole('textbox',{name:'Reference / reason',exact:false}).fill('Too much');failMove=true;
  await page.getByRole('button',{name:'Record movement',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal(await page.getByRole('dialog').count(),1);failMove=false;await page.keyboard.press('Escape');
  await page.setViewportSize({width:360,height:900});await main.getByRole('button',{name:'Purchase orders',exact:true}).click();await main.getByRole('button',{name:'New order',exact:false}).click();
  assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Purchase order form fits mobile');await page.screenshot({path:path.join(output,'order-form-360.png')});await page.keyboard.press('Escape');
  await page.addInitScript(()=>localStorage.setItem('care360.selectedBranchCode','ALL'));await page.reload();await main.getByText('Organisation overview.',{exact:false}).waitFor();assert(await main.getByRole('button',{name:'New item',exact:false}).isDisabled(),'Organisation overview disables writes');
  await page.addInitScript(()=>localStorage.setItem('care360.selectedBranchCode','MAIN'));session.permissions=['Inventory.View'];await page.reload();await main.getByRole('heading',{name:'Inventory',exact:true}).waitFor();await page.waitForTimeout(500);assert.equal(await main.getByRole('button',{name:'New item',exact:false}).count(),0,'Read-only role has no create action');
  workspace={items:[],vendors:[],assets:[],orders:[],movements:[],departments:[]};await page.reload();await main.getByRole('button',{name:'Items & stock',exact:true}).click();await main.getByText('No stock items yet',{exact:true}).waitFor();
  failLoad=true;await main.getByRole('button',{name:'Refresh',exact:true}).click();await main.getByRole('alert').waitFor();failLoad=false;await main.getByRole('button',{name:'Retry',exact:true}).click();await main.getByText('No stock items yet',{exact:true}).waitFor();
  assert.deepEqual(errors,[],'No browser runtime errors');
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,responsiveCases:24,workflow:['create item','create order','approve','partial receipt','department issue','ledger','error retention','duplicate-submit guard','mobile order form','organisation read-only','read-only role','empty stock','load-error retry'],liveDataTouched:false},null,2));
  console.log('PASS inventory browser: 24 responsive cases and purchase-to-issue workflow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

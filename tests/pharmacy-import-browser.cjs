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
session.permissions.push('Pharmacy.Import','Pharmacy.Drug.View','Pharmacy.Drug.Manage','Pharmacy.Stock.View','Pharmacy.Stock.Manage','Pharmacy.Generic.Manage','Pharmacy.Configuration.Manage');

const output=path.resolve('artifacts/pharmacy');fs.mkdirSync(output,{recursive:true});
const csv='MedicineCode,BrandName,GenericName,DosageFormCode,RouteCode,TherapeuticCategoryCode,Unit\r\nPARA500,Paracetamol 500 mg,Paracetamol,TABLET,ORAL,ANALGESIC,Tablet\r\n';
let invalid=false,commits=0;
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(s=>{localStorage.setItem('care360.auth.session',JSON.stringify(s));localStorage.setItem('care360.selectedBranchCode','MAIN');},session);
 await page.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(!p.includes('/api/'))return route.continue();let data=[];
 if(p.endsWith('/auth/me'))data=session;
 else if(p.endsWith('/administration/branch-context'))data={organizationAccess:true,branches:[branch,second]};
 else if(p.endsWith('/administration/hospital'))data=hospital;
 else if(p.includes('/imports/template/'))return route.fulfill({contentType:'text/csv',headers:{'content-disposition':'attachment; filename="template.csv"'},body:csv});
 else if(p.endsWith('/imports/reference-codes'))data=[{column:'DosageFormCode',code:'TABLET',name:'Tablet'}];
 else if(p.endsWith('/imports/preview'))data={id:'11111111-1111-1111-1111-111111111111',status:invalid?'INVALID':'READY',rowCount:1,errorCount:invalid?1:0,invalidRows:invalid?1:0,issues:invalid?[{row:2,column:'MedicineCode',message:'Duplicate medicine code.'}]:[],samples:[{medicineCode:'PARA500',brandName:'Paracetamol 500 mg',genericName:'Paracetamol',dosageFormCode:'TABLET',routeCode:'ORAL',salePrice:2.5}]};
 else if(p.endsWith('/commit')){commits++;await new Promise(r=>setTimeout(r,700));data={status:'COMMITTED'};}
 else if(p.endsWith('/pharmacy/dashboard'))data={prescriptionQueue:0,dispensedToday:0,salesToday:0,lowStockItems:0,expiringSoon:0,expiredBatches:0,stockValue:0,recentDispensings:[]};
 else if(p.includes('/options'))data={genericDrugs:[],forms:[],routes:[],categories:[],manufacturers:[],drugs:[],departments:[]};
 await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,statusCode:200,message:'OK',data,errors:[]})});});
 await page.goto(base+'/pharmacy');await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 for(const width of [360,768,1366,1920]){await page.setViewportSize({width,height:900});assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Import fits '+width);await page.screenshot({path:path.join(output,'import-'+width+'.png')});}
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download CSV template',exact:true}).click();assert((await download).suggestedFilename().endsWith('.csv'));
 await dialog.locator('input[type=file]').setInputFiles({name:'catalogue.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 invalid=true;await dialog.getByRole('button',{name:'Validate file',exact:true}).click();await dialog.getByText('Fix errors and upload again',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Import data',exact:true}).count(),0);
 invalid=false;await dialog.getByRole('button',{name:'Validate file',exact:true}).click();await dialog.getByText('Ready to import',{exact:true}).waitFor();assert(await dialog.getByRole('button',{name:'Import data',exact:true}).isDisabled());
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Import data',exact:true}).click();assert(await dialog.getByRole('button',{name:'Close',exact:true}).isDisabled());await dialog.getByText('Imported successfully',{exact:true}).waitFor();assert.equal(commits,1);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,responsiveWidths:[360,768,1366,1920],checks:['template download','invalid-row preview','confirmation required','single commit','busy close guard','success summary'],liveDataTouched:false},null,2));console.log('PASS pharmacy import browser: responsive UI, template, validation and commit');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

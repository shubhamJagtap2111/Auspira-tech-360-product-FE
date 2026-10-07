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
const output=path.resolve('artifacts/administration');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(session=>localStorage.setItem('care360.auth.session',JSON.stringify(session)),session);
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(!url.pathname.includes('/api/'))return route.continue();
      let data=[];const p=url.pathname;
      if(p.endsWith('/auth/me'))data=session;
      else if(p.endsWith('/administration/branch-context'))data={organizationAccess:true,branches:[branch,second]};
      else if(p.endsWith('/administration/hospital'))data=hospital;
      else if(p.endsWith('/administration/users/assignable-roles'))data=[{...role,roleNameKey:'Doctor'},{...role,roleCode:'HOSPITAL_ADMIN',roleNameKey:'Hospital Administrator'},{...role,roleCode:'SUPER_ADMIN',roleNameKey:'Super Administrator'}];
      else if(p.endsWith('/administration/users/reference-data'))data={languages:[{languageCode:'en-US',englishName:'English'}],timeZones:[{timeZoneCode:'Asia/Kolkata',displayNameKey:'India (IST)'}]};
      else if(p.endsWith('/administration/users'))data={items:[user],pageNumber:1,pageSize:10,totalCount:1};
      else if(p.endsWith('/administration/departments'))data=[department];
      else if(p.endsWith('/administration/branches'))data=[branch,second];
      else if(p.includes('/administration/branches/'))data=branch;
      else if(p.endsWith('/rbac/roles'))data=[role];
      else if(p.endsWith('/rbac/roles/DOCTOR'))data=role;
      else if(p.includes('/permission-catalog'))data=catalog;
      else if(p.includes('/localization/catalog'))data={resources:{},languages:[],seedData:{},version:1,cultureCode:'en-US'};
      return route.fulfill({json:{success:true,statusCode:200,data,message:'Fixture',errors:[]}});
    });
    const report=[];
    for(const width of [360,768,1366,1920])for(const section of ['hospital','users','roles','departments','branches']){
      await page.setViewportSize({width,height:900});errors=[];
      await page.goto(`${base}/administration/${section}`);await page.waitForTimeout(700);
      const main=page.locator('main');await main.waitFor();
      if(section==='users')await main.getByRole('button',{name:/Dr Ananya Rao/}).click();
      if(section==='roles')await main.getByRole('button',{name:/Doctor DOCTOR/}).click();
      if(section==='departments')await main.getByRole('button',{name:/New Department|New department|add New/}).click();
      if(section==='branches')await main.getByRole('button',{name:/Pune Main Hospital/}).click();
      if(section!=='hospital'){
        const dialog=page.getByRole('dialog');await dialog.waitFor();
        const measurements=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left,scroll:el.scrollWidth,client:el.clientWidth}));
        assert(measurements.left>=-1 && measurements.width<=width+1,`${section} drawer fits ${width}px`);
        assert(measurements.scroll<=measurements.client+1,`${section} no drawer overflow at ${width}px`);
        const actions=page.locator('.ac-admin-drawer-actions');assert(await actions.isVisible());
        await page.locator('.ac-admin-drawer-body').evaluate(el=>el.scrollTop=el.scrollHeight);
        assert(await actions.isVisible(),`${section} save actions visible after scrolling`);
        await page.locator('.ac-admin-drawer-body').evaluate(el=>el.scrollTop=0);
        const outside=await dialog.evaluate(el=>[...el.querySelectorAll('input,ac-dropdown,textarea')].filter(x=>{const a=x.getBoundingClientRect(),b=el.getBoundingClientRect();return a.width>0&&(a.left<b.left-1||a.right>b.right+1)}).length);
        assert.equal(outside,0,`${section} fields fit drawer`);
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${section} no page overflow at ${width}px`);
      assert.deepEqual(errors,[],`${section} no browser errors`);
      await page.screenshot({path:path.join(output,`${section}-${width}.png`),fullPage:false});
      report.push({section,width,passed:true});
    }
    await page.goto(`${base}/administration/permissions`);await page.waitForTimeout(500);assert(page.url().endsWith('/administration/roles'));
    assert.equal(await page.getByRole('link',{name:'Permission Matrix',exact:true}).count(),0);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,cases:report},null,2));console.log(JSON.stringify({passed:true,cases:report.length,output}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

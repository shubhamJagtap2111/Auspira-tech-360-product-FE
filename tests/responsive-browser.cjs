const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const base=process.env.RESPONSIVE_BASE_URL||'http://127.0.0.1:4205';
const permissions=[...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(m=>m[1]);
const session={userId:'responsive-test',email:'layout@example.test',fullName:'Responsive Test Administrator',accessToken:'local-fixture',refreshToken:'fixture',accessTokenExpiresAt:'2099-01-01T00:00:00Z',permissions,roleCodes:['HOSPITAL_ADMIN'],menuItems:[],hospitalName:'Care360 Test Hospital',tenantCode:'layout'};
const report={reportKey:'ipd-bed',categoryKey:'ipd',title:'IPD & Bed Overview',description:'Admissions, discharges, occupancy, and ward status.',fromDate:'2026-09-01',toDate:'2026-09-27',branch:'',department:'',doctorId:null,kpis:['Active IPD','Admissions','Discharges','Occupancy'].map((label,i)=>({label,value:String(i+2),meta:'Current period',icon:'bed',color:'#2563eb'})),trend:[],table:{columns:['Ward','Total beds','Occupied','Available','Cleaning','Maintenance'],rows:[{'Ward':'General Ward','Total beds':'30','Occupied':'20','Available':'8','Cleaning':'1','Maintenance':'1'}]},drilldowns:[{label:'Open IPD',route:'/ipd',icon:'bed'},{label:'View all admissions',route:'/ipd',icon:'arrow_forward'}],generatedAt:'2026-09-27T10:00:00Z'};
const workspace={fromDate:report.fromDate,toDate:report.toDate,branch:'',categories:[{key:'ipd',title:'IPD',description:'Inpatient reports',icon:'bed',tone:'blue',availableReports:1,reports:[{key:'ipd-bed',categoryKey:'ipd',title:report.title,description:report.description,icon:'bed',route:'/ipd'}]}],summary:{patients:12,appointments:9,opdVisits:5,activeIpd:2,revenue:1200,outstanding:300},trend:[],alerts:[],branches:[],departments:[],doctors:[],generatedAt:report.generatedAt};
const dashboard={summary:{totalHospitals:1,totalUsers:4,activeUsers:4,activeSessions:2,branchCount:1,departmentCount:3,auditEventsToday:7,loginsToday:2,notificationTemplateCount:1,storedProfileImageCount:0,subscriptionStatusCode:'ACTIVE',licenseStatusCode:'ACTIVE',systemHealthStatusCode:'HEALTHY',generatedAt:report.generatedAt},operationalSummary:{totalPatients:24,patientsToday:3,todaysAppointments:9,todaysOpdVisits:5,currentIpdPatients:2,doctorsAvailable:4,totalDoctors:6,availableBeds:8,totalBeds:10,emergencyCasesToday:0,pendingBills:2,pendingBillAmount:1800,pharmacyOrdersToday:2,pendingLabTests:3},activityTrend:[{activityDate:report.generatedAt,loginAttempts:2,successfulSignIns:2,failedSignIns:0,recordUpdates:3,securityEvents:0}],auditSummary:[],recentLogins:[],notifications:[],systemHealth:[{componentCode:'Database',statusCode:'HEALTHY',messageKey:'Database ready'}]};
const routes=(process.env.RESPONSIVE_ROUTES||'/,/reports?report=ipd-bed,/patients,/doctors,/appointments,/opd,/ipd,/emergency,/laboratory,/pharmacy,/billing,/inventory,/reports/mis,/quality,/administration,/administration/users,/administration/roles,/administration/permissions,/administration/departments,/administration/designations,/administration/branches,/administration/hospital,/administration/system-configuration,/profile/account-settings,/profile/security-settings,/profile/activity-logs,/profile/change-password,/support,/documentation').split(',');
const widths=(process.env.RESPONSIVE_WIDTHS||'360,768,1024,1280,1366,1920').split(',').map(Number);
let browser;
(async()=>{
 browser=await chromium.launch({headless:true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
 const page=await browser.newPage({hasTouch:true});
 await page.addInitScript(session=>localStorage.setItem('care360.auth.session',JSON.stringify(session)),session);
 const fontCache = new Map();
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('/api/')) {
     let data=null;
     if(url.pathname.endsWith('/auth/me'))data=session;
     if(url.pathname.endsWith('/administration/dashboard'))data=dashboard;
     if(url.pathname.includes('/pharmacy/'))data=[];
     if(url.pathname.endsWith('/pharmacy/dashboard'))data={pendingPrescriptions:6,dispensedToday:3,salesToday:1450,lowStockItems:2,expiringBatches:1,expiredBatches:0,stockValue:45000,recentDispensings:[]};
     if(url.pathname.endsWith('/pharmacy/drug-master/options'))data={genericDrugs:[],dosageForms:[],routes:[],therapeuticCategories:[],manufacturers:[]};
     if(url.pathname.endsWith('/pharmacy/formulary/options'))data={departments:[],drugs:[]};
     if(url.pathname.endsWith('/pharmacy/interactions/options'))data={genericDrugs:[],severities:[],behaviors:[]};
     if(url.pathname.endsWith('/pharmacy/allergy-mappings/options'))data={genericDrugs:[],behaviors:[]};
     if(url.pathname.endsWith('/reports/workspace')||url.pathname.endsWith('/mis/dashboard'))data=workspace;
     if(url.pathname.endsWith('/reports/generate'))data=report;
     return route.fulfill({json:{success:data!==null,data,message:'Local layout fixture',errors:[],statusCode:200}});
   }
   if (['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) {
     if (!fontCache.has(url.href)) { const response = await route.fetch(); fontCache.set(url.href, { status: response.status(), headers: response.headers(), body: await response.body() }); }
     return route.fulfill(fontCache.get(url.href));
   }
   if(url.origin!==base)return route.abort();
   return route.continue();
 });
 const results=[];
 const tag=(process.env.RESPONSIVE_RESULT_TAG||'').replace(/[^a-z0-9_-]/gi,'');
 const saveResults=()=>{fs.mkdirSync('artifacts/responsive',{recursive:true});fs.writeFileSync(`artifacts/responsive/results${tag?'-'+tag:''}.json`,JSON.stringify(results,null,2));};
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#application-navigation')?.contains(document.activeElement));
 if (!await page.locator('.shell-main').evaluate(el=>el.inert))throw Error('Mobile navigation background is not inert');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.activeElement?.id==='mobile-navigation-trigger');
 if (!await page.locator('#mobile-navigation-trigger').evaluate(el=>el===document.activeElement))throw Error('Mobile navigation did not restore keyboard focus');
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.locator('#application-navigation').getByRole('link',{name:'Patients',exact:true}).click();
 await page.waitForTimeout(250);
 if (await page.locator('.shell-main').evaluate(el=>el.inert))throw Error('Mobile navigation stayed open after changing page');
 console.log('Mobile navigation focus, Escape, and route selection passed');
 for(const width of widths){
   await page.setViewportSize({width,height:900});
   for(const route of routes){
     await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('.main-content', {timeout:15000});await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]));await page.waitForTimeout(250);
     const result=await page.evaluate(()=>{
       const main=document.querySelector('.main-content');
       if(!main)return {missing:true,url:location.pathname};
       const clips=[];
       for(const el of document.querySelectorAll('.main-content button,.main-content input,.main-content select,.header button')){
         const box=el.getBoundingClientRect();if(!box.width||!box.height)continue;
         if(box.right<=innerWidth+1&&box.left>=-1)continue;
         let scrollable=false;
         for(let p=el.parentElement;p&&!p.classList.contains('main-content');p=p.parentElement){if(['auto','scroll'].includes(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth){scrollable=true;break;}}
         if(!scrollable)clips.push((el.textContent||el.getAttribute('placeholder')||el.tagName).trim().slice(0,65));
       }
       const bounds=main.getBoundingClientRect();
       const outside=[...main.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>bounds.right+1&&!el.closest('.table-wrap,.table-scroll,.pharmacy-tabs,.tabs');}).slice(0,12).map(el=>({tag:el.tagName,cls:el.className,width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}));
       return {outside,url:location.pathname,overflow:main.scrollWidth-main.clientWidth,headerOverflow:document.querySelector('.header').scrollWidth-document.querySelector('.header').clientWidth,clips:[...new Set(clips)]};
     });
     results.push({width,route,...result});
     if (process.env.RESPONSIVE_DROPDOWNS) {
       const dropdowns = page.locator('ac-dropdown');
       let checked = 0;
       for (let i=0;i<await dropdowns.count();i++) {
         const dropdown=dropdowns.nth(i), trigger=dropdown.locator('.ac-dropdown-trigger'), panel=dropdown.locator('.ac-dropdown-panel');
         if (!await trigger.isVisible() || await trigger.isDisabled()) continue;
         await trigger.click(); await panel.waitFor();
         const outside=page.locator('.main-content h1').first();
         if (width<=1024) await outside.tap(); else await outside.click();
         await panel.waitFor({state:'hidden'});
         await trigger.click(); await panel.waitFor();
         await page.keyboard.press('Escape'); await panel.waitFor({state:'hidden'});
         if (!await trigger.evaluate(el=>el===document.activeElement))throw Error('Dropdown Escape focus failed '+width+' '+route);
         await trigger.click(); await panel.waitFor();
         await page.getByRole('button',{name:'Search application',exact:true}).focus();
         await panel.waitFor({state:'hidden'});
         checked++;
       }
       results.at(-1).dropdownChecks=checked;
       console.log(`Dropdown dismissal ${width} ${route}: ${checked} controls`);
     }
     if(process.env.RESPONSIVE_PROGRESS)console.log(`Checked ${width} ${route}`);
     if(result.missing||result.overflow>1||result.headerOverflow>1||result.clips?.length)console.log(JSON.stringify(results.at(-1)));
     if (process.env.RESPONSIVE_SCREENSHOTS && [360,768,1366,1920].includes(width) && ['/', '/patients', '/laboratory', '/pharmacy', '/administration/users', '/reports?report=ipd-bed'].includes(route)) {
       fs.mkdirSync('artifacts/responsive/enterprise',{recursive:true});
       await page.screenshot({path:`artifacts/responsive/enterprise/${route.replace(/[^a-z0-9]/gi,'_')||'dashboard'}-${width}.png`});
     }
   }
   saveResults();
   if (process.env.RESPONSIVE_DROPDOWNS && process.env.RESPONSIVE_DROPDOWN_EDITORS !== '0') {
     await page.goto(base+'/',{waitUntil:'domcontentloaded'});
     for (const [label,selector] of [['Notifications','.notif-panel'],['Account menu','.profile-drop'],['Language','.lang-drop']]) {
       const trigger=page.getByRole('button',{name:label,exact:true});
       if (!await trigger.isVisible()) continue;
       const popup=page.locator(selector);
       await trigger.click(); await popup.waitFor();
       await trigger.click(); await popup.waitFor({state:'hidden'});
       await trigger.click(); await popup.waitFor();
       // Header popups can cover the page heading on phones; tap exposed shell padding.
       if(width<=1024)await page.locator('.shell').tap({position:{x:8,y:880}});else await page.locator('.shell').click({position:{x:8,y:880}});
       await popup.waitFor({state:'hidden'});
       await trigger.click(); await popup.waitFor();
       await page.keyboard.press('Escape'); await popup.waitFor({state:'hidden'});
     }
     for (const [route,action] of [['/patients','Register Patient'],['/doctors','Add Doctor'],['/appointments','Create Appointment']]) {
       await page.goto(base+route,{waitUntil:'domcontentloaded'});
       await page.getByRole('button',{name:new RegExp(action+'$')}).first().click();
       const drawer=page.locator('.ac-admin-drawer'); await drawer.waitFor();
       const dropdowns=drawer.locator('ac-dropdown');
       for(let i=0;i<await dropdowns.count();i++) {
         const trigger=dropdowns.nth(i).locator('.ac-dropdown-trigger'), panel=dropdowns.nth(i).locator('.ac-dropdown-panel');
         if(!await trigger.isVisible()||await trigger.isDisabled())continue;
         await trigger.click();await panel.waitFor();
         if(width<=1024)await drawer.locator('h2').tap();else await drawer.locator('h2').click();
         await panel.waitFor({state:'hidden'});
         await trigger.click();await panel.waitFor();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
         if(!await drawer.isVisible())throw Error('Escape closed the editor instead of its dropdown');
       }
       if(route==='/patients') {
         for(const [button,panel] of [['.country-trigger','.country-panel'],['.date-trigger','.modern-date-popover']]) {
           const trigger=drawer.locator(button), popup=drawer.locator(panel);
           await trigger.click();await popup.waitFor();
           if(width<=1024)await drawer.locator('h2').tap();else await drawer.locator('h2').click();
           await popup.waitFor({state:'hidden'});
           await trigger.click();await popup.waitFor();await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
           if(!await drawer.isVisible())throw Error('Escape closed the patient editor instead of its popup');
         }
       }
     }
     console.log('Header menus and registration/editor popups passed at '+width);
   }
 }
 saveResults();
 await page.setViewportSize({width:1366,height:900});await page.goto(base+'/reports?report=ipd-bed',{waitUntil:'domcontentloaded'});await page.waitForTimeout(600);await page.screenshot({path:'artifacts/responsive/reports-laptop.png'});
 await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'artifacts/responsive/reports-tablet.png'});
 await page.goto(base+'/pharmacy',{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);await page.screenshot({path:'artifacts/responsive/pharmacy-tablet.png'});
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 if (!await page.locator('html').evaluate(el=>el.classList.contains('dark')))throw Error('Dark theme toggle failed');
 await page.screenshot({path:'artifacts/responsive/dashboard-dark-tablet.png'});
 await page.getByRole('button',{name:'Light mode',exact:true}).click();
 if (process.env.RESPONSIVE_DIALOGS) {
   for (const width of [360,768,1366]) {
     await page.setViewportSize({width,height:900});await page.goto(base+'/pharmacy?tab=medicines',{waitUntil:'domcontentloaded'});
     await page.getByRole('button',{name:/Add Medicine/}).first().click();
     await page.locator('.modal').waitFor({state:'visible'});
     const dialog = await page.locator('.modal').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,overflow:el.scrollWidth-el.clientWidth};});
     if(dialog.left<0||dialog.right>dialog.viewport+1||dialog.overflow>1)throw Error('Medicine dialog overflow at '+width+': '+JSON.stringify(dialog));
     console.log('Medicine dialog fits at '+width);
   }
 }
 await browser.close();
 const failures=results.filter(r=>r.missing||r.overflow>1||r.headerOverflow>1||r.clips?.length);
 console.log(`${results.length-failures.length}/${results.length} viewport checks passed`);process.exitCode=failures.length?1:0;
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});

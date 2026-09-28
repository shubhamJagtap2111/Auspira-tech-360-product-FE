const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const base=process.env.RESPONSIVE_BASE_URL||'http://127.0.0.1:4205';
const permissions=[...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(m=>m[1]);
const session={userId:'responsive-test',email:'layout@example.test',fullName:'Responsive Test Administrator',accessToken:'local-fixture',refreshToken:'fixture',accessTokenExpiresAt:'2099-01-01T00:00:00Z',permissions,roleCodes:['HOSPITAL_ADMIN'],menuItems:[],hospitalName:'Care360 Test Hospital',tenantCode:'layout'};
const report={reportKey:'ipd-bed',categoryKey:'ipd',title:'IPD & Bed Overview',description:'Admissions, discharges, occupancy, and ward status.',fromDate:'2026-09-01',toDate:'2026-09-27',branch:'',department:'',doctorId:null,kpis:['Active IPD','Admissions','Discharges','Occupancy'].map((label,i)=>({label,value:String(i+2),meta:'Current period',icon:'bed',color:'#2563eb'})),trend:[],table:{columns:['Ward','Total beds','Occupied','Available','Cleaning','Maintenance'],rows:[{'Ward':'General Ward','Total beds':'30','Occupied':'20','Available':'8','Cleaning':'1','Maintenance':'1'}]},drilldowns:[{label:'Open IPD',route:'/ipd',icon:'bed'},{label:'View all admissions',route:'/ipd',icon:'arrow_forward'}],generatedAt:'2026-09-27T10:00:00Z'};
const workspace={fromDate:report.fromDate,toDate:report.toDate,branch:'',categories:[{key:'ipd',title:'IPD',description:'Inpatient reports',icon:'bed',tone:'blue',availableReports:1,reports:[{key:'ipd-bed',categoryKey:'ipd',title:report.title,description:report.description,icon:'bed',route:'/ipd'}]}],summary:{patients:12,appointments:9,opdVisits:5,activeIpd:2,revenue:1200,outstanding:300},trend:[],alerts:[],branches:[],departments:[],doctors:[],generatedAt:report.generatedAt};
const routes=(process.env.RESPONSIVE_ROUTES||'/reports?report=ipd-bed,/patients,/doctors,/appointments,/opd,/ipd,/laboratory,/pharmacy,/billing,/inventory,/reports/mis,/quality,/administration/users,/administration/roles,/administration/permissions,/administration/departments,/administration/branches,/administration/hospital,/administration/system-configuration').split(',');
const widths=(process.env.RESPONSIVE_WIDTHS||'360,768,1024,1280,1366,1920').split(',').map(Number);
(async()=>{
 const browser=await chromium.launch({headless:true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
 const page=await browser.newPage();
 await page.addInitScript(session=>localStorage.setItem('care360.auth.session',JSON.stringify(session)),session);
 const fontCache = new Map();
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('/api/')) {
     let data=null;
     if(url.pathname.endsWith('/auth/me'))data=session;
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
 for(const width of widths){
   await page.setViewportSize({width,height:900});
   for(const route of routes){
     await page.goto(base+route);await page.waitForSelector('.main-content', {timeout:15000});await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,5000))]));await page.waitForTimeout(400);
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
     if(process.env.RESPONSIVE_PROGRESS)console.log(`Checked ${width} ${route}`);
     if(result.missing||result.overflow>1||result.headerOverflow>1||result.clips?.length)console.log(JSON.stringify(results.at(-1)));
   }
 }
 fs.mkdirSync('artifacts/responsive',{recursive:true});fs.writeFileSync('artifacts/responsive/results.json',JSON.stringify(results,null,2));
 await page.setViewportSize({width:1366,height:900});await page.goto(base+'/reports?report=ipd-bed');await page.waitForTimeout(600);await page.screenshot({path:'artifacts/responsive/reports-laptop.png'});
 await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'artifacts/responsive/reports-tablet.png'});
 await page.goto(base+'/pharmacy');await page.waitForTimeout(700);await page.screenshot({path:'artifacts/responsive/pharmacy-tablet.png'});
 if (process.env.RESPONSIVE_DIALOGS) {
   for (const width of [360,768,1366]) {
     await page.setViewportSize({width,height:900});await page.goto(base+'/pharmacy?tab=medicines');
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
})();

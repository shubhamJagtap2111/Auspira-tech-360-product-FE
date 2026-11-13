const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.WORKSPACE_BASE_URL || 'http://127.0.0.1:4217';
const permissions = [...fs.readFileSync('src/app/app.routes.ts', 'utf8').matchAll(/permission: '([^']+)'/g)].map(m => m[1]);
const session = { userId:'layout-test', fullName:'Hospital Administrator', email:'ui@example.test', accessToken:'fixture', refreshToken:'fixture', accessTokenExpiresAt:'2099-01-01T00:00:00Z', permissions, roleCodes:['HOSPITAL_ADMIN'], menuItems:[], hospitalName:'Auspira City Hospital', tenantCode:'layout' };
const branch = { branchCode:'MAIN', branchName:'Pune Main Hospital', branchGuid:'11111111-1111-1111-1111-111111111111', hospitalGuid:'22222222-2222-2222-2222-222222222222', isActive:true, isDefault:true };
const lab = { todayOrders:24, pendingCollection:8, processing:12, verificationPending:4, reportsToday:18, statOpen:2, criticalUnacknowledged:1 };
const ipd = { summary:{currentAdmissions:32,availableBeds:18,occupiedBeds:32,totalBeds:50,occupancyPercent:64,admissionsToday:6,dischargesToday:4}, wards:[],rooms:[],admissions:[],recentAdmissions:[],activePatients:[],beds:[],attentionItems:[],patients:[],doctors:[],generatedAt:new Date().toISOString() };
const billing = { summary:{todayBilling:128450,monthBilling:2847500,outstanding:450000,refunds:4500,todayCollections:118000,invoiceCount:38,paymentCount:34,pendingRefunds:2},trend:[],breakdown:[],recentInvoices:[],generatedAt:new Date().toISOString() };
const pharmacy = { pendingPrescriptions:6,dispensedToday:18,salesToday:124850,lowStockItems:3,expiringBatches:2,expiredBatches:1,stockValue:450000,recentDispensings:[] };
const inventory = {items:[{id:'i1',branch:'MAIN',name:'Examination gloves',category:'CONSUMABLE',unit:'Box',onHand:20,reorderLevel:25,unitCost:120,active:true}],assets:[],vendors:[],orders:[],movements:[],departments:[]};
const patients = {patients:[{patientGuid:'33333333-3333-3333-3333-333333333333',medicalRecordNo:'DEMO-0001',firstName:'Aarav',lastName:'Sharma',fullName:'Aarav Sharma (Demo)',mobileNo:'+91 9000000000',genderCode:'MALE',genderName:'Male',dateOfBirth:'1990-01-01',age:36,bloodGroupName:'B+',statusCode:'ACTIVE',statusName:'Active',createdDate:'2026-11-01T00:00:00Z',lastVisitDate:'2026-11-01T00:00:00Z',rowVersion:'1'}],stats:{totalPatients:12480,checkedInToday:42,newThisMonth:186,pendingReview:8},totalCount:1,pageNumber:1,pageSize:10};
const doctors = {doctors:[],stats:{totalDoctors:48,activeDoctors:42,onLeaveDoctors:4,expiringRegistrations:2},totalCount:0,pageNumber:1,pageSize:10};
const definition={key:'ipd-bed',categoryKey:'ipd',title:'IPD & Bed Overview',description:'Admissions and bed capacity',icon:'bed',route:'/reports?report=ipd-bed'};
const reports={fromDate:'2026-10-01',toDate:'2026-10-08',branch:'MAIN',summary:{patients:12480,appointments:82,opdVisits:52,activeIpd:32,revenue:128450,outstanding:450000},categories:[{key:'ipd',title:'IPD',description:'Bed capacity',icon:'bed',tone:'#2563eb',availableReports:1,reports:[definition]}],trend:[],alerts:[],branches:[],departments:[],doctors:[],generatedAt:new Date().toISOString()};
const report={reportKey:'ipd-bed',categoryKey:'ipd',title:definition.title,description:definition.description,fromDate:reports.fromDate,toDate:reports.toDate,branch:'MAIN',department:'',doctorId:null,kpis:[{label:'Occupancy',value:'64%',meta:'Occupied beds',icon:'bed',color:'#2563eb'}],trend:[],table:{columns:[],rows:[]},drilldowns:[],generatedAt:reports.generatedAt};
const quality={year:2026,month:10,department:'',totalIndicators:12,onTarget:8,attention:2,critical:1,noData:1,overallCompliance:72.7,indicators:[],recentEvents:[],recentAudits:[],generatedAt:reports.generatedAt};

// Generate empty profile structures from their declared API models, then add synthetic identity.
function profileFixture(file, name) {
  const ts = require('typescript');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const interfaces = new Map(source.statements.filter(ts.isInterfaceDeclaration).map(node => [node.name.text, node]));
  const value = type => {
    if (!type) return null;
    if (ts.isArrayTypeNode(type)) return [];
    if (ts.isUnionTypeNode(type)) return value(type.types.find(t => t.kind !== ts.SyntaxKind.NullKeyword && t.getText(source) !== 'null'));
    if (type.kind === ts.SyntaxKind.NumberKeyword) return 0;
    if (type.kind === ts.SyntaxKind.BooleanKeyword) return false;
    if (type.kind === ts.SyntaxKind.StringKeyword) return '';
    if (ts.isTypeReferenceNode(type)) return model(type.typeName.getText(source));
    return null;
  };
  const model = name => {
    const node = interfaces.get(name); if (!node) return null;
    const result = {};
    for (const clause of node.heritageClauses || []) for (const parent of clause.types) Object.assign(result, model(parent.expression.getText(source)));
    for (const member of node.members) if (member.name) result[member.name.getText(source)] = value(member.type);
    return result;
  };
  return model(name);
}
const patientProfile = {...profileFixture('src/app/features/patients/patient-management.models.ts','PatientProfile'),...patients.patients[0]};
const doctorProfile = {...profileFixture('src/app/features/doctors/doctor-management.models.ts','DoctorProfile'),doctorGuid:'44444444-4444-4444-4444-444444444444',doctorCode:'DEMO-D01',fullName:'Dr Ananya Rao (Demo)',firstName:'Ananya',lastName:'Rao',statusCode:'ACTIVE',statusName:'Active',departmentName:'General Medicine',primarySpecialization:'Internal Medicine',profilePhotoUrl:null};

const output = path.resolve('artifacts/compact-ui'); fs.mkdirSync(output,{recursive:true});
const resultFile = path.join(output, process.env.COMPACT_RESULT_TAG ? 'results-'+process.env.COMPACT_RESULT_TAG.replace(/[^a-z0-9_-]/gi,'')+'.json' : process.env.COMPACT_ROUTES?'results-additional.json':'results.json');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage(); const errors = []; page.on('pageerror',e => {errors.push(e.message); console.error('Runtime:',e.message);});
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
    await page.addInitScript(s => {localStorage.setItem('care360.auth.session',JSON.stringify(s));localStorage.setItem('care360.selectedBranchCode','MAIN');},session);
    await page.route('**/*', async route => {
      const url=new URL(route.request().url()), p=url.pathname;
      if(!p.includes('/api/')) return url.origin===base ? route.continue() : route.abort();
      let data=[];
      if(p.endsWith('/auth/me')) data=session;
      else if(p.endsWith('/administration/branch-context')) data={organizationAccess:true,branches:[branch]};
      else if(p.endsWith('/administration/hospital')) data={hospitalName:'Auspira City Hospital',branding:{}};
      else if(p.endsWith('/administration/dashboard')) data={summary:{totalHospitals:1,totalUsers:4,activeUsers:4,activeSessions:2,branchCount:1,departmentCount:3,auditEventsToday:7,loginsToday:2,notificationTemplateCount:1,storedProfileImageCount:0,subscriptionStatusCode:'ACTIVE',licenseStatusCode:'ACTIVE',systemHealthStatusCode:'HEALTHY'},operationalSummary:{totalPatients:24,patientsToday:3,todaysAppointments:9,todaysOpdVisits:5,currentIpdPatients:2,doctorsAvailable:4,totalDoctors:6,availableBeds:8,totalBeds:10,emergencyCasesToday:0,pendingBills:2,pendingBillAmount:1800,pharmacyOrdersToday:2,pendingLabTests:3},activityTrend:[],auditSummary:[],recentLogins:[],notifications:[],systemHealth:[]};
      else if(p.endsWith('/patients')) data=patients;
      else if(p.endsWith('/patients/'+patientProfile.patientGuid)) data=patientProfile;
      else if(p.endsWith('/doctors/'+doctorProfile.doctorGuid)) data=doctorProfile;
      else if(p.endsWith('/support')) data={summary:{open:0,priority:0,completedToday:0},canManage:false,tickets:[],contacts:[],total:0,page:1,pageSize:20};
      else if(p.endsWith('/doctors')) data=doctors;
      else if(p.endsWith('/appointments')||p.endsWith('/queue')||p.endsWith('/opd/consultations')||p.endsWith('/opd/follow-ups')) data=[];
      else if(p.endsWith('/opd/configuration')) data={pharmacyIntegrationEnabled:false};
      else if(p.endsWith('/ipd/dashboard')) data=ipd;
      else if(p.endsWith('/laboratory/dashboard')) data=lab;
      else if(p.endsWith('/billing/dashboard')) data=billing;
      else if(p.endsWith('/pharmacy/dashboard')) data=pharmacy;
      else if(p.endsWith('/inventory/workspace')) data=inventory;
      else if(p.endsWith('/reports/workspace')||p.endsWith('/mis/dashboard')) data=reports;
      else if(p.endsWith('/reports/generate')||p.includes('/mis/reports/')) data=report;
      else if(p.endsWith('/quality/dashboard')) data=quality;
      else if(p.endsWith('/pharmacy/drug-master/options')) data={genericDrugs:[],dosageForms:[],routes:[],therapeuticCategories:[],manufacturers:[]};
      else if(p.endsWith('/pharmacy/formulary/options')) data={departments:[],drugs:[]};
      else if(p.endsWith('/pharmacy/interactions/options')) data={genericDrugs:[],severities:[],behaviors:[]};
      else if(p.endsWith('/pharmacy/allergy-mappings/options')) data={genericDrugs:[],behaviors:[]};
      await route.fulfill({json:{success:true,statusCode:200,message:'Browser fixture',data,errors:[]}});
    });

    const routes=(process.env.COMPACT_ROUTES||'/,/patients,/doctors,/appointments,/opd,/ipd,/emergency,/laboratory,/pharmacy,/billing,/inventory,/reports?report=ipd-bed,/reports/mis,/quality,/patients/33333333-3333-3333-3333-333333333333,/doctors/44444444-4444-4444-4444-444444444444,/administration/roles,/administration/branches,/profile,/support').split(',');
    const results=[];
    for(const theme of (process.env.COMPACT_THEMES||'light,dark').split(',')) {
      for(const width of [390,1366]) {
        await page.setViewportSize({width,height:900});
        for(const route of routes) {
          console.log(`Checking ${theme} ${width}px ${route}`);
          await page.goto(base+route,{waitUntil:'domcontentloaded'});
          const toggle=page.locator('ac-kpi-toggle button');
          await toggle.waitFor();
          await page.waitForFunction(()=>document.querySelectorAll('[acKpiRegion]').length>0);
          await page.waitForLoadState('networkidle');
          if (await page.locator('html').evaluate(el=>el.classList.contains('dark')) !== (theme === 'dark')) {
            await page.getByRole('button',{name:theme==='dark'?'Dark mode':'Light mode',exact:true}).click();
          }
          await page.waitForFunction(theme=>document.documentElement.classList.contains('dark')===(theme==='dark'),theme);
          await page.evaluate(()=>document.fonts.ready);
          assert.equal(await toggle.count(),1,route+' single page toggle');
          if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
          await page.waitForFunction(()=>[...document.querySelectorAll('[acKpiRegion]')].every(e=>!e.hidden));
          const shown=await page.evaluate(()=>{
            const main=document.querySelector('.main-content');
            const header=main.querySelector('header,.page-header');
            const toggle=main.querySelector('ac-kpi-toggle button').getBoundingClientRect();
            return {dark:document.documentElement.classList.contains('dark'),overflow:main.scrollWidth-main.clientWidth,headerHeight:Math.round(header?.getBoundingClientRect().height||0),toggleHeight:toggle.height,toggleRight:toggle.right};
          });
          assert.equal(shown.overflow,0,theme+' '+width+' '+route+' page overflow');
          assert.ok(shown.toggleRight<=width+1,route+' toggle clipped');
          if(width===390)assert.ok(shown.toggleHeight>=44,route+' mobile target');
          const safe=await page.locator('.alert.critical:visible,.safety-metric-grid:visible').count();
          await toggle.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(()=>[...document.querySelectorAll('[acKpiRegion]')].every(e=>e.hidden&&getComputedStyle(e).display==='none')).catch(async e=>{console.error(await page.evaluate(()=>({url:location.href,toggle:document.querySelector('ac-kpi-toggle')?.outerHTML,regions:[...document.querySelectorAll('[acKpiRegion]')].map(r=>({hidden:r.hidden,display:getComputedStyle(r).display}))})));throw e;});
          assert.equal(await toggle.getAttribute('aria-expanded'),'false');
          assert.equal(await page.locator('.alert.critical:visible,.safety-metric-grid:visible').count(),safe,route+' clinical alerts remain visible');
          // Full reload must preserve the route preference.
          await page.reload({waitUntil:'domcontentloaded'});
          await toggle.waitFor();
          await page.waitForFunction(()=>document.querySelector('[acKpiRegion]')?.hidden);
          assert.match(await toggle.innerText(),/Show KPIs/);
          await page.waitForLoadState('networkidle');
          if (await page.locator('html').evaluate(el=>el.classList.contains('dark')) !== (theme === 'dark')) {
            await page.getByRole('button',{name:theme==='dark'?'Dark mode':'Light mode',exact:true}).click();
          }
          await page.waitForFunction(theme=>document.documentElement.classList.contains('dark')===(theme==='dark'),theme);
          if(route==='/patients'){
            await page.screenshot({path:path.join(output,'patients-'+theme+'-'+width+'-hidden.png'),fullPage:true});
          }
          await toggle.click();
          await page.waitForFunction(()=>!document.querySelector('[acKpiRegion]')?.hidden);
          if(route==='/patients'||process.env.COMPACT_ROUTES||process.env.COMPACT_SCREENSHOTS)await page.screenshot({path:path.join(output,route.split('?')[0].slice(1).replaceAll('/','-')+'-'+theme+'-'+width+'-shown.png'),fullPage:true});
          results.push({theme,width,route,...shown});
          fs.writeFileSync(resultFile,JSON.stringify(results,null,2));
        }
        console.log(theme+' '+width+'px: '+routes.length+' pages; toggle, keyboard, persistence, overflow and safety checks passed');
      }
    }
    // Page preferences remain independent during SPA navigation.
    await page.goto(base+'/patients');await page.locator('ac-kpi-toggle button').waitFor();
    await page.getByRole('button',{name:'Hide KPIs',exact:true}).click();
    await page.locator('#application-navigation').getByRole('link',{name:'Doctors',exact:true}).click();
    await page.getByRole('button',{name:'Hide KPIs',exact:true}).waitFor();
    await page.locator('#application-navigation').getByRole('link',{name:'Patients',exact:true}).click();
    await page.getByRole('button',{name:'Show KPIs',exact:true}).waitFor();
    assert.deepEqual(errors,[],'No browser runtime errors');
    fs.writeFileSync(resultFile,JSON.stringify(results,null,2));
    console.log(results.length+' compact UI checks passed; independent SPA page preferences verified');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

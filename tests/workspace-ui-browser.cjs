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
const patients = {patients:[],stats:{totalPatients:12480,checkedInToday:42,newThisMonth:186,pendingReview:8},totalCount:0,pageNumber:1,pageSize:20};
const doctors = {doctors:[],stats:{totalDoctors:48,activeDoctors:42,onLeaveDoctors:4,expiringRegistrations:2},totalCount:0,pageNumber:1,pageSize:20};
const definition={key:'ipd-bed',categoryKey:'ipd',title:'IPD & Bed Overview',description:'Admissions and bed capacity',icon:'bed',route:'/reports?report=ipd-bed'};
const reports={fromDate:'2026-10-01',toDate:'2026-10-08',branch:'MAIN',summary:{patients:12480,appointments:82,opdVisits:52,activeIpd:32,revenue:128450,outstanding:450000},categories:[{key:'ipd',title:'IPD',description:'Bed capacity',icon:'bed',tone:'#2563eb',availableReports:1,reports:[definition]}],trend:[],alerts:[],branches:[],departments:[],doctors:[],generatedAt:new Date().toISOString()};
const report={reportKey:'ipd-bed',categoryKey:'ipd',title:definition.title,description:definition.description,fromDate:reports.fromDate,toDate:reports.toDate,branch:'MAIN',kpis:[{label:'Occupancy',value:'64%',meta:'Occupied beds',icon:'bed',color:'#2563eb'}],trend:[],table:{columns:[],rows:[]},insights:[],generatedAt:reports.generatedAt};
const quality={year:2026,month:10,department:'',totalIndicators:12,onTarget:8,attention:2,critical:1,noData:1,overallCompliance:72.7,indicators:[],recentEvents:[],recentAudits:[],generatedAt:reports.generatedAt};
const output = path.resolve('artifacts/workspace-ui'); fs.mkdirSync(output,{recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage(); const errors = []; page.on('pageerror',e => errors.push(e.message));
    await page.addInitScript(s => {localStorage.setItem('care360.auth.session',JSON.stringify(s));localStorage.setItem('care360.selectedBranchCode','MAIN');},session);
    await page.route('**/*', async route => {
      const url=new URL(route.request().url()), p=url.pathname;
      if(!p.includes('/api/')) return url.origin===base ? route.continue() : route.abort();
      let data=[];
      if(p.endsWith('/auth/me')) data=session;
      else if(p.endsWith('/administration/branch-context')) data={organizationAccess:true,branches:[branch]};
      else if(p.endsWith('/administration/hospital')) data={hospitalName:'Auspira City Hospital',branding:{}};
      else if(p.endsWith('/patients')) data=patients;
      else if(p.endsWith('/doctors')) data=doctors;
      else if(p.endsWith('/appointments')||p.endsWith('/queue')||p.endsWith('/opd/consultations')||p.endsWith('/opd/follow-ups')) data=[];
      else if(p.endsWith('/opd/configuration')) data={pharmacyIntegrationEnabled:false};
      else if(p.endsWith('/ipd/dashboard')) data=ipd;
      else if(p.endsWith('/laboratory/dashboard')) data=lab;
      else if(p.endsWith('/billing/dashboard')) data=billing;
      else if(p.endsWith('/pharmacy/dashboard')) data=pharmacy;
      else if(p.endsWith('/inventory/workspace')) data=inventory;
      else if(p.endsWith('/reports/workspace')||p.endsWith('/mis/dashboard')) data=reports;
      else if(p.endsWith('/reports/generate')) data=report;
      else if(p.endsWith('/quality/dashboard')) data=quality;
      else if(p.endsWith('/pharmacy/drug-master/options')) data={genericDrugs:[],dosageForms:[],routes:[],therapeuticCategories:[],manufacturers:[]};
      else if(p.endsWith('/pharmacy/formulary/options')) data={departments:[],drugs:[]};
      else if(p.endsWith('/pharmacy/interactions/options')) data={genericDrugs:[],severities:[],behaviors:[]};
      else if(p.endsWith('/pharmacy/allergy-mappings/options')) data={genericDrugs:[],behaviors:[]};
      await route.fulfill({json:{success:true,statusCode:200,message:'Browser fixture',data,errors:[]}});
    });
    const routes=(process.env.WORKSPACE_ROUTES||'/patients,/doctors,/appointments,/opd,/ipd,/emergency,/laboratory,/pharmacy,/billing,/inventory,/reports?report=ipd-bed,/reports/mis,/quality').split(',');
    const results=[];
    for(const width of (process.env.WORKSPACE_WIDTHS||'360,768,1366,1920').split(',').map(Number)) {
      await page.setViewportSize({width,height:900});
      for(const route of routes) {
        console.log(`Checking ${width}px ${route}`);
        await page.goto(base+route,{waitUntil:'domcontentloaded'});
        await page.locator('ac-kpi-card').first().waitFor();
        await page.waitForFunction(() => !document.querySelector('ac-kpi-card [aria-busy="true"]'));
        const result=await page.evaluate(() => {
          const main=document.querySelector('.main-content');
          const cards=[...document.querySelectorAll('ac-kpi-card .kpi-card')];
          const values=[...document.querySelectorAll('ac-kpi-card .kpi-value')];
          const wrapped=values.filter(e=>{const range=document.createRange();range.selectNodeContents(e);return range.getClientRects().length>1;}).length;
          return { overflow:main.scrollWidth-main.clientWidth, wrapped, cards:cards.length, radii:cards.map(e=>getComputedStyle(e).borderRadius), clipped:cards.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1;}).length };
        });
        assert.equal(result.overflow,0,`${width} ${route} page overflow`);
        assert.equal(result.clipped,0,`${width} ${route} card clipping`);
        assert.equal(result.wrapped,0,`${width} ${route} split KPI numbers`);
        assert.ok(result.radii.every(r=>r==='12px'),`${width} ${route} inconsistent cards`);
        results.push({width,route,...result});
        if(width===360||width===1366) await page.screenshot({path:path.join(output,route.slice(1).replace(/[^a-z0-9_-]/gi,'-')+'-'+width+'.png'),fullPage:true});
      }
      console.log(`Shared KPI layout verified at ${width}px across ${routes.length} pages`);
    }
    await page.goto(base+'/pharmacy');
    await page.getByRole('button',{name:/Prescription queue/}).click();
    await page.waitForFunction(()=>location.search.includes('prescriptions'));
    await page.goto(base+'/inventory');
    await page.getByRole('button',{name:/Replenishment needed/}).click();
    assert.equal(await page.getByRole('combobox',{name:'Filter status'}).inputValue(),'LOW');
    await page.goto(base+'/emergency');
    assert.equal(await page.getByRole('button',{name:/New Record/}).count(),0);
    assert.ok((await page.locator('ac-kpi-card').allTextContents()).every(t=>t.includes('Live data unavailable')));
    await page.goto(base+'/laboratory');
    await page.getByRole('button',{name:'Dark mode',exact:true}).click();
    const contrast = await page.evaluate(() => {
      const luminance = color => {
        const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
        return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
      };
      const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const title=document.querySelector('.ac-workspace h1');
      const panel=document.querySelector('.ac-workspace .panel');
      const critical=document.querySelector('.alert.critical');
      const darkSurface = luminance(getComputedStyle(panel).backgroundColor)<.1;
      if(!darkSurface) throw Error('Laboratory panel does not use a dark surface');
      const gradientColors=getComputedStyle(panel).backgroundImage.match(/rgba?\([^)]*\)/g)||[];
      if(!gradientColors.every(color=>luminance(color)<.1)) throw Error('A light gradient covers the dark Laboratory surface');
      return [ratio(getComputedStyle(title).color,getComputedStyle(document.querySelector('.main-content')).backgroundColor),ratio(getComputedStyle(panel.querySelector('h2')).color,getComputedStyle(panel).backgroundColor),ratio(getComputedStyle(critical.querySelector('strong')).color,getComputedStyle(critical).backgroundColor)];
    });
    assert.ok(contrast.every(value=>value>=4.5),'Readable dark headings and priority alerts: '+contrast.join(', '));
    await page.screenshot({path:path.join(output,'laboratory-dark.png'),fullPage:true});
    await page.getByRole('button',{name:/Sample pending/}).click();
    await page.getByRole('heading',{name:'Pending collection',exact:true}).waitFor();
    assert.deepEqual(errors,[],'No browser runtime errors');
    fs.writeFileSync(path.join(output,process.env.WORKSPACE_ROUTES?'results-targeted.json':'results.json'),JSON.stringify(results,null,2));
    console.log(`${results.length} viewport checks passed; queue actions, low-stock filter, dark mode and unavailable data verified`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

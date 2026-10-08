const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve('dist/auspira-care360-web/browser');
const permissions=[...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(m=>m[1]);
const session={userId:'inbox-test',fullName:'Hospital Administrator',email:'inbox@example.test',accessToken:'fixture',refreshToken:'fixture',accessTokenExpiresAt:'2099-01-01T00:00:00Z',permissions,roleCodes:['HOSPITAL_ADMIN'],menuItems:[],hospitalName:'Auspira City Hospital',tenantCode:'inbox-fixture'};
const branches=['MAIN','SECOND'].map((code,i)=>({branchCode:code,branchName:i?'Second Hospital':'Main Hospital',branchGuid:`00000000-0000-0000-0000-00000000000${i+1}`,isActive:true,isDefault:!i}));
const output=path.resolve('artifacts/notification-inbox');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root)){res.writeHead(400).end();return;}if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(resolve=>server.listen(4218,'127.0.0.1',resolve));const base='http://127.0.0.1:4218';
 const browser=await chromium.launch({headless:true,channel:'chrome'});const results=[];
 try{
  for(const width of [360,768,1366,1920]){
   const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();const errors=[];let unavailable=false;let requests=[];page.on('pageerror',e=>errors.push(e.message));
   let items=Array.from({length:35},(_,i)=>({id:`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,branchCode:'MAIN',module:i===0?'Laboratory':'Inventory',priority:i===0?'CRITICAL':'WARNING',title:i===0?'Critical laboratory result':`Stock review ${i}`,message:i===0?'Immediate review and explicit acknowledgement are required.':'Review consumable stock before the next order.',actionUrl:i===0?'/laboratory?tab=critical':'/inventory?tab=items',createdAt:new Date(Date.now()-i*60000).toISOString(),readAt:null}));
   items.push({...items[1],id:'second-alert',branchCode:'SECOND',title:'Second branch stock alert'});
   await page.addInitScript(s=>{localStorage.setItem('care360.auth.session',JSON.stringify(s));if(!localStorage.getItem('care360.selectedBranchCode'))localStorage.setItem('care360.selectedBranchCode','MAIN');},session);
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname;
    if(!p.includes('/api/'))return url.origin===base?route.continue():route.abort();
    requests.push({path:p,method:request.method()});let data=[];
    if(p.endsWith('/auth/me'))data=session;
    else if(p.endsWith('/administration/branch-context'))data={organizationAccess:true,branches};
    else if(p.endsWith('/administration/hospital'))data={hospitalName:'Auspira City Hospital',branding:{}};
    else if(p.includes('/notification-inbox')){
     if(unavailable)return route.fulfill({status:503,json:{success:false,data:null}});
     const branch=request.headers()['x-branch-code']||'MAIN';
     if(p.endsWith('/read-all')){items.filter(x=>x.branchCode===branch).forEach(x=>x.readAt=new Date().toISOString());data={changed:35};}
     else if(p.endsWith('/read')){const id=p.split('/').at(-2);const item=items.find(x=>x.id===id&&x.branchCode===branch);if(item)item.readAt=new Date().toISOString();data={read:true};}
     else if(p.endsWith('/refresh'))data={refreshed:true};
     else{const scoped=items.filter(x=>x.branchCode===branch);let filtered=scoped.filter(x=>(!url.searchParams.get('module')||x.module===url.searchParams.get('module'))&&(!url.searchParams.get('priority')||x.priority===url.searchParams.get('priority'))&&(url.searchParams.get('unreadOnly')!=='true'||!x.readAt));const n=Number(url.searchParams.get('page')||1);data={items:filtered.slice((n-1)*30,n*30),unreadCount:scoped.filter(x=>!x.readAt).length,total:filtered.length,page:n,pageSize:30};}
    }else if(p.endsWith('/inventory/workspace'))data={items:[],assets:[],orders:[],vendors:[],movements:[],departments:[]};
    else if(p.endsWith('/laboratory/dashboard'))data={todayOrders:0,pendingCollection:0,processing:0,verificationPending:0,reportsToday:0,statOpen:0,criticalUnacknowledged:1};
    await route.fulfill({json:{success:true,statusCode:200,message:'Local test fixture',data,errors:[]}});
   });
   await page.goto(`${base}/notifications`);await page.getByRole('heading',{name:'Critical laboratory result',exact:true}).waitFor();
   assert.equal(await page.locator('.nav-item[href="/emergency"]').count(),0,'Emergency is absent from navigation');
   assert(await page.locator('.notif-dot').textContent()==='35');
   await page.getByRole('button',{name:'Notifications',exact:true}).click();await page.locator('.notif-panel .np-item').first().waitFor();
   assert.equal(await page.locator('.notif-panel .np-item').count(),5);
   const box=await page.locator('.notif-panel').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);
   await page.locator('.notif-panel .np-item').first().click();await page.waitForURL('**/laboratory?tab=critical');
   await page.locator('button.active').filter({hasText:'Critical'}).waitFor();
   assert(!requests.some(x=>x.path.includes('acknowledge')),'Opening/reading critical notification does not acknowledge clinical result');
   await page.goto(`${base}/notifications`);await page.getByRole('heading',{name:'Critical laboratory result',exact:true}).waitFor();
   assert(items[0].readAt,'Read status persists after navigation');
   await page.getByLabel('Unread only').check();await page.waitForFunction(()=>!document.querySelector('.items')?.textContent.includes('Critical laboratory result'));
   await page.getByLabel('Unread only').uncheck();
   await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2',{exact:true}).waitFor();
   assert.equal(await page.locator('.items article').count(),5);
   await page.getByRole('button',{name:'Previous',exact:true}).click();
   await page.getByRole('button',{name:'Mark all as read',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.notif-dot'));
   assert(items.find(x=>x.branchCode==='SECOND').readAt===null,'Mark all preserves unread alerts in another branch');
   await page.screenshot({path:path.join(output,`notifications-${width}.png`),fullPage:true});
   assert(await page.evaluate(()=>document.querySelector('.main-content').scrollWidth<=document.querySelector('.main-content').clientWidth+1),'No horizontal overflow');
   unavailable=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').waitFor();
   assert((await page.getByRole('alert').innerText()).includes('retry'),'Network failure provides retry feedback');
   unavailable=false;
   // Reload into another selected branch, as the shell does when switching workspaces.
   await page.evaluate(()=>localStorage.setItem('care360.selectedBranchCode','SECOND'));await page.reload();await page.getByRole('heading',{name:'Second branch stock alert'}).waitFor();
   await page.waitForLoadState('networkidle');assert.equal(await page.locator('.items article').count(),1);assert(!await page.getByRole('heading',{name:'Critical laboratory result',exact:true}).count());
   assert.deepEqual(errors,[]);
   results.push({width,passed:true,checks:['live-count','popup','read-persistence','critical-separation','pagination','mark-all','branch-switch','error-feedback','responsive','emergency-hidden']});await context.close();
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({productionDataTouched:false,results},null,2));console.log('PASS Notification inbox: four screen sizes, persisted read actions, queue links, branch isolation, errors and pagination');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

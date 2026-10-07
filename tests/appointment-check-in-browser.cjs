const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve('dist/auspira-care360-web/browser');
const permissions = [...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(m=>m[1]);
const session = { userId:'fixture',email:'layout@example.test',fullName:'Preview administrator',permissions,roleCodes:['HOSPITAL_ADMIN'],accessToken:'fixture',refreshToken:'fixture',accessTokenExpiresAt:'2099-01-01T00:00:00Z',menuItems:[],hospitalName:'Test Hospital',tenantCode:'test' };
const patient = { patientGuid:'10000000-0000-0000-0000-000000000001',fullName:'Synthetic appointment patient',medicalRecordNo:'TEST-001',genderName:'Female',age:35 };
const doctor = { doctorGuid:'20000000-0000-0000-0000-000000000001',fullName:'Dr. Test',departmentName:'General Medicine',primarySpecialization:'General Medicine',branchName:'Main Branch',email:'doctor@example.test',statusCode:'ACTIVE' };
const starts = new Date(); starts.setHours(10,0,0,0);
const appointments = [0,1].map(i=>({id:'30000000-0000-0000-0000-00000000000'+(i+1),appointmentNo:'APT-TEST-'+i,patientId:patient.patientGuid,doctorId:doctor.doctorGuid,startsAt:new Date(starts.getTime()+i*3600000).toISOString(),appointmentType:'NEW_CONSULTATION',branchName:'Main Branch',departmentName:'General Medicine',statusCode:'SCHEDULED',createdAt:new Date().toISOString()}));
let queueRecords = [], creates = 0, updates = 0;
const server = http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage({hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(session=>localStorage.setItem('care360.auth.session',JSON.stringify(session)),session);
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(!url.pathname.includes('/api/'))return url.origin===base?route.continue():route.abort();

   const p=url.pathname.replace(/^.*\/api\/v1/,'');let data=[];
   if(p==='/auth/me')data=session;
   if(p==='/patients')data={patients:[patient],totalCount:1,pageNumber:1,pageSize:100,stats:{}};
   if(p==='/doctors')data={doctors:[doctor],totalCount:1,pageNumber:1,pageSize:100,stats:{}};
   if(p==='/appointments')data=appointments;
   if(p==='/queue')data=queueRecords;
   if(p.startsWith('/queue/appointment/'))data=queueRecords.find(queue=>queue.appointmentId===p.split('/').pop())||null;
   if(p==='/queue' && route.request().method()==='POST'){
    creates++; const request=route.request().postDataJSON();
    const existing=queueRecords.find(queue=>queue.appointmentId===request.appointmentId);
    data=existing||{...request,id:'40000000-0000-0000-0000-000000000001',createdAt:new Date().toISOString(),appointmentStatusCode:'CHECKED_IN'};
    if(!existing)queueRecords.push(data);
    appointments.find(appointment=>appointment.id===request.appointmentId).statusCode='CHECKED_IN';
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   if(p.startsWith('/queue/') && route.request().method()==='PUT'){
    updates++; const request=route.request().postDataJSON();
    data={...queueRecords[0],...request,appointmentStatusCode:'CHECKED_IN'};queueRecords[0]=data;
   }
   if(route.request().method()!=='GET')assert.ok(p.startsWith('/queue'),'check-in must not separately update appointment');
   if(p==='/administration/hospital')data={hospitalName:'Test Hospital'};
   return route.fulfill({json:{success:true,data,message:'',errors:[],statusCode:200}});
  });
  for(const width of [360,768,1366,1920]){
   queueRecords=[];creates=0;updates=0;appointments.forEach(appointment=>appointment.statusCode='SCHEDULED');
   await page.setViewportSize({width,height:900});await page.goto(base+'/appointments');
   await page.getByRole('button',{name:/^Check in/}).first().click();
   const add=page.getByRole('button',{name:'Add to Doctor Queue'});await add.waitFor();
   await add.evaluate(button=>{button.click();button.click();});
   await page.getByRole('button',{name:'Add to Doctor Queue'}).waitFor({state:'hidden'});
   assert.equal(creates,1);assert.equal(queueRecords.length,1);
   await page.getByRole('button',{name:/^Update check-in/}).first().click();
   await page.getByText('Already added to doctor queue',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Add to Doctor Queue'}).count(),0);
   await page.locator('textarea[name="checkInNotes"]').fill('Updated reception note');
   await page.getByRole('button',{name:/Update check-in/}).last().click();
   await page.locator('textarea[name="checkInNotes"]').waitFor({state:'hidden'});
   assert.equal(creates,1);assert.equal(updates,1);assert.equal(queueRecords[0].notes,'Updated reception note');
   await page.reload();
   await page.getByRole('button',{name:/^Update check-in/}).first().waitFor();
   console.log('Check-in, double-click protection, queued update and refresh passed at '+width);
  }
  assert.deepEqual(errors,[]);
 } finally { await browser.close();server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
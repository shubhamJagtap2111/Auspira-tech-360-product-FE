// Isolated synthetic hospital support fixture. No live API calls or credentials.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const root=path.resolve('dist/auspira-care360-web/browser');
const users=[{userId:'11111111-1111-4111-8111-111111111111',name:'Alex Morgan',manager:true},{userId:'22222222-2222-4222-8222-222222222222',name:'Dr Maya Rao',manager:false}];
const permissions=[...fs.readFileSync('src/app/app.routes.ts','utf8').matchAll(/permission: '([^']+)'/g)].map(x=>x[1]);
const tickets=[],activities=[],writes=[];let failure='online';
function create(actor,body){const now=new Date().toISOString(),ticket={...body,id:randomUUID(),ticketNo:'HC-'+String(tickets.length+1).padStart(6,'0'),branchCode:'MAIN',requesterId:actor.userId,requesterName:actor.name,status:'OPEN',assigneeId:null,assigneeName:'',resolution:'',version:1,createdAt:now,updatedAt:now,resolvedAt:null};tickets.push(ticket);event(ticket,actor,body.requestId,'CREATED','Ticket created');return ticket;}
function event(ticket,actor,requestId,kind,body){activities.push({id:randomUUID(),ticketId:ticket.id,actorId:actor.userId,actorName:actor.name,requestId,kind,body,createdAt:new Date().toISOString()});}
create(users[1],{requestId:randomUUID(),title:'Cannot access a saved billing document',description:'The billing document workspace does not open after selecting a saved invoice. Please review the software configuration.',category:'TECHNICAL',module:'BILLING',priority:'HIGH'});
create(users[0],{requestId:randomUUID(),title:'Review ward setup before rollout',description:'Please help the ward team review the room and bed configuration before beginning the admission workflow.',category:'IMPLEMENTATION',module:'IPD',priority:'NORMAL'});
const httpHandler=async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),actor=req.socket.localPort===4332?users[1]:users[0];
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'");
 const session={userId:actor.userId,email:'support@example.test',fullName:actor.name,accessToken:'sample-'+actor.userId,refreshToken:'sample',accessTokenExpiresAt:'2099-01-01T00:00:00Z',permissions:actor.manager?[...permissions,'Support.Manage']:permissions,roleCodes:[actor.manager?'HOSPITAL_ADMIN':'DOCTOR'],menuItems:[],hospitalName:'Sample Hospital',tenantCode:'support-preview'};
 const reply=(data,status=200,message='')=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({success:status<400,statusCode:status,message,data}));};
 if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(`<script>localStorage.clear();localStorage.setItem('care360.auth.session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('care360.selectedBranchCode','MAIN');location.replace('/support');</script>`);}
 if(url.pathname==='/fixture/state')return reply({tickets,activities,writes});
 if(url.pathname==='/fixture/control'&&req.method==='POST'){failure=url.searchParams.get('mode')||'online';return reply({failure});}
 if(url.pathname.startsWith('/api/v1/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},api=url.pathname.replace('/api/v1','');
  if(req.method!=='GET')writes.push({actor:actor.userId,api,body});
  if(api==='/auth/me')return reply(session);
  if(api==='/administration/hospital')return reply({hospitalName:'Sample Hospital'});
  if(api==='/administration/branch-context')return reply({organizationAccess:actor.manager,branches:[{branchGuid:randomUUID(),hospitalGuid:randomUUID(),branchCode:'MAIN',branchName:'Central hospital',isDefault:true,isActive:true},{branchGuid:randomUUID(),hospitalGuid:randomUUID(),branchCode:'SECOND',branchName:'North hospital',isActive:true}]});
  if(api.includes('/localization/catalog'))return reply({version:1,effectiveCulture:'en-US',languages:[],resources:{},seedDataSets:[]});
  if(api.includes('/localization/version'))return reply({version:1});
  if(api==='/notification-inbox')return reply({items:[],total:0,unreadCount:0});
  if(api==='/notification-inbox/refresh')return reply({refreshed:true});
  if(api==='/chat/conversations')return reply([]);
  const branch=req.headers['x-branch-code']||'MAIN';const visible=t=> (branch==='ALL'||branch===t.branchCode)&&(actor.manager||t.requesterId===actor.userId);
  if(api==='/support'){
   if(failure==='offline')return reply(null,503,'Synthetic Help Center outage');
   let values=tickets.filter(visible),all=[...values];const search=(url.searchParams.get('search')||'').toLowerCase();
   values=values.filter(t=>(t.title+' '+t.ticketNo).toLowerCase().includes(search)&&['status','priority','module'].every(key=>!url.searchParams.get(key)||t[key]===url.searchParams.get(key))&&(url.searchParams.get('mine')!=='true'||t.requesterId===actor.userId)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
   const page=+(url.searchParams.get('page')||1);
   return reply({canManage:actor.manager,total:values.length,page,pageSize:25,tickets:values.slice((page-1)*25,page*25),contacts:branch==='ALL'?[]:users.filter(u=>u.manager).map(u=>({...u,department:'Hospital administration'})),summary:{open:all.filter(t=>!['RESOLVED','CLOSED'].includes(t.status)).length,priority:all.filter(t=>!['RESOLVED','CLOSED'].includes(t.status)&&['HIGH','URGENT'].includes(t.priority)).length,completedToday:all.filter(t=>t.resolvedAt).length}});
  }
  if(api==='/support/tickets'&&req.method==='POST'){
   if(failure==='offline')return reply(null,503,'Synthetic outage; draft is preserved');
   const old=tickets.find(t=>t.requesterId===actor.userId&&t.requestId===body.requestId),ticket=old||create(actor,body);
   if(failure==='lost-ack'){failure='online';return reply(null,503,'Synthetic acknowledgement loss after commit');}return reply({id:ticket.id});
  }
  if(api.startsWith('/support/tickets/')){
   const id=api.split('/')[3],ticket=tickets.find(t=>t.id===id&&visible(t));if(!ticket)return reply(null,404,'Ticket unavailable');
   if(api.endsWith('/replies')){
    if(ticket.status==='CLOSED')return reply(null,400,'Reopen before replying');
    if(!activities.some(a=>a.actorId===actor.userId&&a.requestId===body.requestId)){event(ticket,actor,body.requestId,'COMMENT',body.body);ticket.version++;ticket.updatedAt=new Date().toISOString();}return reply({saved:true});
   }
   if(api.endsWith('/status')){
    if(activities.some(a=>a.actorId===actor.userId&&a.requestId===body.requestId))return reply({saved:true});
    if(ticket.version!==body.version)return reply(null,409,'Ticket changed. Refresh and review the latest update.');
    if(!actor.manager&&!(actor.userId===ticket.requesterId&&['RESOLVED','CLOSED'].includes(ticket.status)&&['OPEN','CLOSED'].includes(body.status)))return reply(null,404,'Only support managers can triage');
    Object.assign(ticket,{status:body.status,priority:body.priority,assigneeId:body.assigneeId,assigneeName:users.find(u=>u.userId===body.assigneeId)?.name||'',resolution:body.resolution,resolvedAt:['RESOLVED','CLOSED'].includes(body.status)?new Date().toISOString():null,updatedAt:new Date().toISOString(),version:ticket.version+1});
    event(ticket,actor,body.requestId,'UPDATE','Status: '+body.status+'\nPriority: '+body.priority+'\nAssignee: '+(body.assigneeId||'')+'\nResolution: '+body.resolution);return reply({saved:true});
   }
   return reply({ticket,activities:activities.filter(a=>a.ticketId===id)});
  }
  if(req.method!=='GET')return reply(null,400,'Unsupported fixture operation');return reply([]);
 }
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]||'application/octet-stream');
 if(ext==='.js')return res.end(fs.readFileSync(file,'utf8').replaceAll('https://auspira-tech-360-product-api.onrender.com/api/v1','/api/v1'));fs.createReadStream(file).pipe(res);
};
for(const port of [4331,4332])http.createServer(httpHandler).listen(port,'127.0.0.1',()=>console.log(`Synthetic support ${port===4331?'manager':'staff'}: http://127.0.0.1:${port}/fixture`));

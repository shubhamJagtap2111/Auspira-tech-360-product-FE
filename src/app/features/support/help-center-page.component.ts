import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { API_BASE_URL } from '../../core/http/api-endpoints';
import { HelpCenterService } from './help-center.service';
import { HelpActivity, HelpDetail, HelpResponse, HelpTicket, HelpWorkspace, TicketDraft, ticketTransitions, validTicket } from './help-center.models';
import { HelpArticle, helpArticles, implementationTasks } from './help-center.articles';

@Component({standalone:true, imports:[CommonModule,FormsModule,RouterLink,A11yModule], changeDetection:ChangeDetectionStrategy.OnPush,
  templateUrl:'./help-center-page.component.html',styleUrl:'./help-center-page.component.css'})
export class HelpCenterPageComponent {
  private readonly api = inject(HelpCenterService);
  readonly auth = inject(AuthStore);
  readonly branch = inject(BranchContextService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly workspace = signal<HelpWorkspace|null>(null);
  readonly detail = signal<HelpDetail|null>(null);
  readonly tab = signal<'tickets'|'knowledge'|'implementation'|'contact'>('tickets');
  readonly article = signal<HelpArticle|null>(null);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly newOpen = signal(false);
  readonly checked = signal<string[]>([]);
  readonly knowledgeSearch = signal('');
  readonly articleCategory = signal('All topics');
  readonly knowledge = computed(()=>helpArticles.filter(item=>(this.articleCategory()==='All topics'||item.category===this.articleCategory()) &&
    [item.title,item.summary,...item.steps].join(' ').toLowerCase().includes(this.knowledgeSearch().trim().toLowerCase())));
  readonly categories = ['All topics',...new Set(helpArticles.map(item=>item.category))];
  readonly tasks = implementationTasks;
  readonly userId = computed(()=>this.auth.session()?.userId??this.auth.profile()?.userId??'');
  readonly concreteBranch = computed(()=>!!this.branch.selectedBranchCode()&&this.branch.selectedBranchCode()!=='ALL');
  readonly canEdit = computed(()=>!!this.workspace()?.canManage&&this.concreteBranch()&&this.detail()?.ticket.branchCode===this.branch.selectedBranchCode());
  readonly transitions = computed(()=>ticketTransitions(this.detail()?.ticket.status??''));
  readonly validNew = ()=>validTicket(this.draft);
  readonly modules = ['GENERAL','OPD','IPD','BILLING','LABORATORY','PHARMACY','INVENTORY','ADMINISTRATION','CHAT'];
  readonly priorities = ['LOW','NORMAL','HIGH','URGENT'];
  readonly statuses = ['OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED'];
  readonly ticketCategories = ['ACCESS','WORKFLOW','TECHNICAL','IMPLEMENTATION','OTHER'];
  search = ''; status = ''; priority = ''; module = ''; mine = false; page = 1;
  draft: TicketDraft = this.emptyDraft();
  replyBody = ''; updateStatus = ''; updatePriority = ''; updateAssignee = ''; updateResolution = '';
  private replyRequest: string = crypto.randomUUID();
  private updateRequest: string = crypto.randomUUID(); private updateVersion = 0;
  private scope = ''; private version = 0; private loadVersion = 0; private detailVersion = 0;
  private searchTimer?: number;
  constructor() {
    effect(()=>{
      const scope=[this.baseUrl,this.auth.session()?.tenantCode??'',this.userId(),this.branch.selectedBranchCode()??''].join('|');
      if(scope===this.scope)return;
      this.scope=scope; this.version++; this.workspace.set(null); this.detail.set(null); this.newOpen.set(false); this.error.set(''); this.notice.set(''); this.page=1;
      this.replyBody=''; this.checked.set(this.readStorage<string[]>('checklist',[]));
      if(this.userId()&&this.branch.selectedBranchCode())void this.load();
    });
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible'&&!this.busy()&&!this.newOpen())void this.load(true);},30000);
    inject(DestroyRef).onDestroy(()=>{this.version++;window.clearInterval(timer);window.clearTimeout(this.searchTimer);});
  }
  label(value:string):string {return value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
  initials(value:string):string{return value.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();}
  private emptyDraft():TicketDraft{return{requestId:crypto.randomUUID(),title:'',description:'',category:'TECHNICAL',module:'GENERAL',priority:'NORMAL'};}
  private readStorage<T>(key:string,fallback:T):T {try{return JSON.parse(sessionStorage.getItem('care360.help|'+this.scope+'|'+key)??'null')??fallback;}catch{return fallback;}}
  private saveStorage(key:string,value:unknown):void {try{sessionStorage.setItem('care360.help|'+this.scope+'|'+key,JSON.stringify(value));}catch{this.notice.set('This browser could not save your draft. Keep this page open until you submit it.');}}
  private message(response:HelpResponse<unknown>,fallback:string):string {const value=response.problem?.detail||response.message;return value&&!/^[A-Z]\w*(\.\w+)+$/.test(value)?value:fallback;}
  async load(quiet=false):Promise<void>{
    const version=this.version, load=++this.loadVersion;
    if(!quiet)this.loading.set(true);
    const query=new URLSearchParams({search:this.search,status:this.status,priority:this.priority,module:this.module,mine:String(this.mine),page:String(this.page)});
    try{
      const response=await this.api.workspace(query);if(version!==this.version||load!==this.loadVersion)return;
      if(!response.success||!response.data){this.error.set(this.message(response,'Help Center could not connect. Your draft is preserved.'));return;}
      this.workspace.set(response.data);this.error.set('');
      const id=this.detail()?.ticket.id??this.route.snapshot.queryParamMap.get('ticket');
      if(id&&/^[0-9a-f-]{36}$/i.test(id))await this.open(id,quiet);
    }finally{if(version===this.version&&load===this.loadVersion)this.loading.set(false);}
  }
  filtersChanged():void{this.page=1;void this.load();}
  searchChanged():void{window.clearTimeout(this.searchTimer);this.searchTimer=window.setTimeout(()=>this.filtersChanged(),300);}
  async open(id:string,quiet=false):Promise<void>{
    const version=this.version, detailVersion=++this.detailVersion;
    if(!quiet){this.detailLoading.set(true);this.detail.set(null);}
    const response=await this.api.detail(id);
    if(version!==this.version||detailVersion!==this.detailVersion)return;
    this.detailLoading.set(false);
    if(!response.success||!response.data){this.detail.set(null);this.error.set(this.message(response,'This ticket is unavailable.'));return;}
    const previous=this.detail()?.ticket;
    this.detail.set(response.data);
    if(!quiet||!previous){this.updateStatus=response.data.ticket.status;this.updatePriority=response.data.ticket.priority;this.updateAssignee=response.data.ticket.assigneeId??'';this.updateResolution=response.data.ticket.resolution;this.updateRequest=crypto.randomUUID();this.updateVersion=response.data.ticket.version;}
    if(!quiet){const draft=this.readStorage<{body:string;requestId:string}>('reply:'+id,{body:'',requestId:crypto.randomUUID()});this.replyBody=draft.body;this.replyRequest=draft.requestId;
      void this.router.navigate([],{relativeTo:this.route,queryParams:{ticket:id},queryParamsHandling:'merge',replaceUrl:true});}
  }
  close():void{this.detailVersion++;this.detail.set(null);this.detailLoading.set(false);void this.router.navigate([],{relativeTo:this.route,queryParams:{ticket:null},queryParamsHandling:'merge',replaceUrl:true});}
  startTicket(category='TECHNICAL'):void{this.draft=this.readStorage<TicketDraft>('new',this.emptyDraft());if(category!=='TECHNICAL'){this.draft.category=category;this.draftChanged();}this.newOpen.set(true);}
  draftChanged():void{this.draft.requestId=crypto.randomUUID();this.saveStorage('new',this.draft);}
  replyChanged():void{this.replyRequest=crypto.randomUUID();const id=this.detail()?.ticket.id;if(id)this.saveStorage('reply:'+id,{body:this.replyBody,requestId:this.replyRequest});}
  updateChanged():void{this.updateRequest=crypto.randomUUID();}
  async create():Promise<void>{
    if(this.busy()||!this.validNew()||!this.concreteBranch())return;
    this.busy.set(true);this.error.set('');const version=this.version;
    try{const response=await this.api.create({...this.draft});if(version!==this.version)return;
      if(!response.success||!response.data){this.error.set(this.message(response,'Could not confirm the ticket. Your details are preserved; retry with the same request.'));return;}
      this.saveStorage('new',null);this.newOpen.set(false);this.notice.set('Ticket created. Your hospital support team can now review it.');this.page=1;this.tab.set('tickets');await this.load();await this.open(response.data.id);
    }finally{this.busy.set(false);}
  }
  async reply():Promise<void>{
    const ticket=this.detail()?.ticket;if(!ticket||this.busy()||!this.replyBody.trim()||!this.concreteBranch())return;
    this.busy.set(true);const version=this.version,body=this.replyBody;
    try{const response=await this.api.reply(ticket.id,this.replyRequest,body.trim());if(version!==this.version)return;
      if(!response.success){this.error.set(this.message(response,'Could not confirm your reply. Your text is preserved for retry.'));return;}
      this.replyBody='';this.replyRequest=crypto.randomUUID();this.saveStorage('reply:'+ticket.id,null);this.notice.set('Reply saved.');await this.open(ticket.id,true);
      // Preserve unsaved triage fields, but account for our own reply's version increment.
      // A different concurrent change still leaves the edit version stale and is rejected.
      if(this.updateVersion===ticket.version && this.detail()?.ticket.version===ticket.version+1)this.updateVersion=ticket.version+1;
      await this.load(true);
    }finally{this.busy.set(false);}
  }
  async update(ownerStatus?:string):Promise<void>{
    const ticket=this.detail()?.ticket;if(!ticket||this.busy()||!this.concreteBranch())return;
    this.busy.set(true);const version=this.version;
    const request={requestId:this.updateRequest,version:ownerStatus?ticket.version:this.updateVersion,status:ownerStatus??this.updateStatus,priority:ownerStatus?ticket.priority:this.updatePriority,
      assigneeId:ownerStatus?ticket.assigneeId:this.updateAssignee||null,resolution:ownerStatus?ticket.resolution:this.updateResolution.trim()};
    try{const response=await this.api.update(ticket.id,request);if(version!==this.version)return;
      if(!response.success){this.error.set(this.message(response,'Ticket update could not be saved. Refresh and review the latest information.'));return;}
      this.notice.set('Ticket updated.');await this.open(ticket.id);await this.load(true);
    }finally{this.busy.set(false);}
  }
  next(delta:number):void{this.page+=delta;void this.load();}
  supportGuide():void{this.article.set(helpArticles.find(item=>item.id==='support')??null);}
  toggleTask(id:string):void{this.checked.update(items=>items.includes(id)?items.filter(x=>x!==id):[...items,id]);this.saveStorage('checklist',this.checked());}
  activityText(activity:HelpActivity):string{if(activity.kind!=='UPDATE')return activity.body;
    return activity.body.replace(/Assignee: ([0-9a-f-]{36})/i,(_,id:string)=>'Assignee: '+(this.workspace()?.contacts.find(c=>c.userId===id)?.name??'Support manager')).replace('Assignee: \n','Assignee: Unassigned\n').replaceAll('_',' ');}
}

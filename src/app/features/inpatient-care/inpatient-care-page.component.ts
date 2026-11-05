import { ClinicalChartWorkspaceComponent } from './clinical-chart-workspace.component';
import { printIdentificationLabel } from './identification-label';
import { MedicationWorkspaceComponent } from './medication-workspace.component';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { workspaceBadgeClass, workspaceStateLabel } from '../../shared/ui/workspace-presentation';
import { CareAdmission, CareDetails, CareForm, CareRow, CareTable, carePayload, nursingForms, nursingTables } from './care-workspace.models';
interface Response<T>{success:boolean;data:T|null;message:string;}
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,AcDropdownComponent,MedicationWorkspaceComponent,ClinicalChartWorkspaceComponent],templateUrl:'./inpatient-care-page.component.html',styleUrls:['../../shared/styles/clinical-integration-workspace.css','./inpatient-care-page.component.css']})
export class InpatientCarePageComponent {
  private readonly api=inject(ApiClientService);protected readonly auth=inject(AuthStore);private readonly branch=inject(BranchContextService);private readonly route=inject(ActivatedRoute);
  protected readonly admissions=signal<CareAdmission[]>([]);protected readonly detail=signal<CareDetails|null>(null);protected readonly optionsData=signal<Record<string,unknown>>({});
  protected readonly busy=signal(false);protected readonly error=signal('');protected readonly notice=signal('');protected readonly tab=signal('nursing');
  protected readonly label=workspaceStateLabel;protected readonly badge=workspaceBadgeClass;
  protected readonly tabs=[{value:'nursing',label:'Nursing care'},{value:'specimens',label:'Specimens'},{value:'medications',label:'Medication'},{value:'analyzer',label:'Analyzer reference'},{value:'chart',label:'Chart & transitions'}];
  protected readonly forms=signal<CareForm[]>(nursingForms);protected readonly tables=signal<CareTable[]>(nursingTables);
  protected readonly availableForms=computed(()=>this.forms().filter(f=>f.tab===this.tab()&&this.can(f.permission)&&this.detail()?.admission.status!=='DISCHARGED'));
  protected readonly visibleTables=computed(()=>this.tables().filter(t=>t.tab===this.tab()));
  protected readonly admissionOptions=computed(()=>[...this.admissions(),...(this.detail()&&!this.admissions().some(a=>a.id===this.detail()!.admission.id)?[this.detail()!.admission]:[])].map(a=>({value:a.id,label:`${a.patient} · ${a.mrn} · ${this.label(a.status)}`})));
  protected readonly selectedForm=computed(()=>this.availableForms().find(f=>f.key===this.formKey())??this.availableForms()[0]??null);
  protected readonly formKey=signal('');protected values:Record<string,unknown>={};protected admissionId='';protected admissionSearch='';protected reason='';protected patientScan='';protected specimenScan='';
  protected reassignTo:Record<string,string>={};protected readonly handoverView=signal<CareRow|null>(null);
  protected readonly timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  private generation=0;private load=0;private commandKeys=new Map<string,{snapshot:string;id:string}>();
  constructor(){effect(()=>{this.branch.selectedBranchCode();this.generation++;this.admissionId=this.route.snapshot.queryParamMap.get('admissionId')??'';this.detail.set(null);this.optionsData.set({});this.values={};this.reason='';this.patientScan='';this.specimenScan='';this.reassignTo={};this.handoverView.set(null);this.commandKeys.clear();void this.refresh();});}
  protected can(action:string){return this.auth.hasPermission('InpatientCare.'+action);}
  protected async refresh(){const g=this.generation;const l=++this.load;this.busy.set(true);this.error.set('');try{
    const [admissions,options]=await Promise.all([this.get<CareAdmission[]>('/inpatient-care/admissions?search='+encodeURIComponent(this.admissionSearch)),this.get<Record<string,unknown>>('/inpatient-care/options')]);
    if(g!==this.generation||l!==this.load)return;this.admissions.set(admissions);this.optionsData.set(options);
    if(this.admissionId){const detail=await this.get<CareDetails>('/inpatient-care/admissions/'+encodeURIComponent(this.admissionId));const analyzer=detail.admission.enabled?await this.get<Record<string,unknown>>('/inpatient-care/admissions/'+encodeURIComponent(this.admissionId)+'/analyzer'):{};if(g===this.generation&&l===this.load)this.detail.set({...detail,analyzerRuns:analyzer['runs']??[],analyzerDevices:analyzer['devices']??[]});}
  }catch(e){if(g===this.generation&&l===this.load)this.error.set(this.message(e));}finally{if(g===this.generation&&l===this.load)this.busy.set(false);}}
  protected async admissionChanged(){this.generation++;this.detail.set(null);this.values={};this.reason='';this.patientScan='';this.specimenScan='';this.commandKeys.clear();await this.refresh();}
  protected selectTab(value:string){this.tab.set(value);this.formKey.set('');this.values={};}
  protected changeForm(){this.values={};}
  protected rows(key:string):CareRow[]{const value=key==='shifts'?this.optionsData()['shifts']:this.detail()?.[key];return Array.isArray(value)?value:[];}
  protected options(source:string):DropdownOption[]{
    if(source==='runKinds')return ['INITIAL','RERUN','CORRECTION','QC'].map(value=>({value,label:this.label(value)}));
    if(source==='fluidDirections')return[{value:'INTAKE',label:'Intake'},{value:'OUTPUT',label:'Output'}];
    if(source==='assignedNurses'){const ids=new Set(this.rows('assignments').map(a=>a['nurseId']));const value=this.optionsData()['nurses'];return Array.isArray(value)?(value as CareRow[]).filter(n=>ids.has(n.id)).map(n=>({value:n.id,label:String(n['name'])})):[];}
    if(source==='assignedShifts')return this.rows('assignments').filter(r=>r.status==='ACTIVE'&&new Date(String(r['endsAt']))>new Date()).map(r=>({value:String(r['shiftId']),label:String(r['nurse'])+' · '+new Date(String(r['startsAt'])).toLocaleString()}));
    let rows:CareRow[]=[];const value=this.optionsData()[source];if(Array.isArray(value))rows=value;
    else rows=this.rows(source);
    return rows.filter(r=>!['COMPLETED','CANCELLED'].includes(r.status??'')).map(r=>({value:r.id,label:String(r['name']??r['problem']??r['title']??r['nurse']??r['code']??r.id)+(r['startsAt']?' · '+new Date(String(r['startsAt'])).toLocaleString():'')+(r['version']?' · '+r['version']:'')}));
  }
  protected formOptions(){return this.availableForms().map(f=>({value:f.key,label:f.title}));}
  protected display(row:CareRow,key:string):string{const value=row[key];if(value==null||value==='')return '—';if(typeof value==='object')return JSON.stringify(value);if(typeof value==='boolean')return value?'Yes':'No';if(key.endsWith('At'))return new Date(String(value)).toLocaleString();return String(value);}
  protected fluidTotal(key:string){const v=this.detail()?.['fluidTotals'];return v&&typeof v==='object'?String((v as Record<string,unknown>)[key]??0):'0';}
  protected async enable(){await this.send(this.base()+'/enable',{reason:this.reason},'commandId');}
  protected async submit(){const form=this.selectedForm();if(!form)return;try{const body=carePayload(form,this.values);const path=['shifts','panels'].includes(form.path)?'/inpatient-care/'+form.path:this.base()+'/'+form.path;await this.send(path,body,'id');}catch(e){this.error.set(this.message(e));}}
  protected newEntry(){this.values={};this.commandKeys.clear();this.notice.set('New entry ready.');}
  protected async status(table:string,row:CareRow,status:string){await this.send(`${this.base()}/${table}/${row.id}/status`,{version:row.version,status,reason:this.reason},'commandId');}
  protected async reviewAnalyzer(row:CareRow,accept:boolean){await this.send(this.base()+'/analyzer/'+row.id+'/review',{accept,reason:this.reason},'commandId');}
  protected async cancelShift(row:CareRow){await this.send(`/inpatient-care/shifts/${row.id}/status`,{version:row.version,status:'CANCELLED',reason:this.reason},'commandId');}
  protected async reassign(row:CareRow){await this.send(`${this.base()}/tasks/${row.id}/reassign`,{assignee:this.reassignTo[row.id],change:{version:row.version,status:'DUE',reason:this.reason}},'commandId');}
  protected fieldChanged(key:string){if(key==='orderId'){const order=this.rows('labOrders').find(r=>r.id===this.values['orderId']);if(order)this.values['specimenCode']=order['specimen'];}}
  protected handoverTasks(){const value=this.handoverView()?.['snapshot'];try{const parsed=typeof value==='string'?JSON.parse(value):value;return Array.isArray(parsed?.outstandingTasks)?parsed.outstandingTasks as CareRow[]:[];}catch{return[];}}
  protected async acknowledge(table:string,row:CareRow){await this.send(`${this.base()}/${table}/${row.id}/acknowledge`,{reason:this.reason},'commandId');}
  protected async refreshEscalations(){await this.send(this.base()+'/escalations/refresh',{reason:this.reason||'Refresh overdue tasks'},'commandId',true);}
  protected async specimenAction(row:CareRow,action:string){await this.send(`${this.base()}/specimens/${row.id}/${action}`,{version:row.version,patientBarcode:this.patientScan,specimenBarcode:this.specimenScan,reason:this.reason},'commandId');}
  protected orderLink(){const a=this.detail()?.admission;return a?{patientId:a.patientId,admissionId:a.id}:{};}
  protected async printLabel(specimen?:CareRow){try{const d=this.detail();if(!d)return;await printIdentificationLabel(specimen?'Specimen label':'Inpatient wristband',[d.admission.patient,d.admission.mrn,...(specimen?[String(specimen['code'])]:[])],specimen?String(specimen['barcode']):d.patientBarcode);}catch(e){this.error.set(this.message(e));}}
  protected base(){return '/inpatient-care/admissions/'+encodeURIComponent(this.admissionId);}
  protected async send(path:string,body:Record<string,unknown>,key:'id'|'commandId',fresh=false){if(this.busy())return;const snapshot=JSON.stringify(body);const prior=this.commandKeys.get(path);const id=!fresh&&prior?.snapshot===snapshot?prior.id:crypto.randomUUID();this.commandKeys.set(path,{snapshot,id});const payload:Record<string,unknown>={...body,[key]:id};if(body['change']&&typeof body['change']==='object'){payload['change']={...body['change'] as object,commandId:id};delete payload['commandId'];}const g=this.generation;this.busy.set(true);this.error.set('');this.notice.set('');try{const result=await firstValueFrom(this.api.post<Response<unknown>>(path,payload));if(!result.success)throw new Error(result.message);if(g===this.generation){this.notice.set('Saved successfully.');await this.refresh();}}catch(e){if(g===this.generation)this.error.set(this.message(e));}finally{if(g===this.generation)this.busy.set(false);}}
  private async get<T>(path:string):Promise<T>{const r=await firstValueFrom(this.api.get<Response<T>>(path));if(!r.success||r.data===null)throw new Error(r.message);return r.data;}
  protected message(e:unknown){return e instanceof Error?workspaceStateLabel(e.message):'Unable to complete the request.';}
}

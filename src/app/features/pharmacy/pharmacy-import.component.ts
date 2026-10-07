import { A11yModule } from '@angular/cdk/a11y';
import { BranchContextService } from '../../core/context/branch-context.service';
import { CommonModule } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/http/api-endpoints';
import { REQUEST_TIMEOUT_MS } from '../../core/interceptors/loader.interceptor';
import { ApiResponse } from '../../core/auth/auth.models';
import { getApiErrorMessage } from '../../core/http/api-error-message';

interface ImportPreview { id: string; status: string; rowCount: number; errorCount: number; invalidRows: number; issues: {row:number;column:string;message:string}[]; samples: Record<string,unknown>[]; }
@Component({standalone:true,selector:'ac-pharmacy-import',imports:[CommonModule,FormsModule,A11yModule],templateUrl:'./pharmacy-import.component.html',styleUrl:'./pharmacy-import.component.css'})
export class PharmacyImportComponent {
  readonly closed=output<void>(); readonly completed=output<void>();
  private readonly http=inject(HttpClient); private readonly base=inject(API_BASE_URL);
  protected readonly branch=inject(BranchContextService);
  private readonly originalBranch=this.branch.selectedBranchCode();
  protected kind='MEDICINES'; protected mode='CREATE_ONLY'; protected file:File|null=null;
  protected readonly busy=signal(false); protected readonly error=signal(''); protected readonly preview=signal<ImportPreview|null>(null);
  protected readonly accepted=signal(false);
  protected reset(){this.preview.set(null);this.error.set('');this.accepted.set(false);}
  protected changed(event:Event){this.file=(event.target as HTMLInputElement).files?.[0]??null;this.reset();}
  protected close(){if(!this.busy())this.closed.emit();}
  protected columns(){return this.kind==='MEDICINES'?['MedicineCode','BrandName','GenericName','Strength','DosageFormCode','RouteCode','SalePrice']:['MedicineCode','BatchNumber','ExpiryDate','Quantity','LocationCode'];}
  protected cell(row:Record<string,unknown>,column:string){return row[column.charAt(0).toLowerCase()+column.slice(1)]??row[column]??'—';}
  private async request<T>(path:string,body:unknown):Promise<T>{
    const value=await firstValueFrom(this.http.post<T|{success:boolean;data:T;message:string}>(this.base+'/pharmacy/imports'+path,body,{withCredentials:true,context:new HttpContext().set(REQUEST_TIMEOUT_MS,360000)}));
    if(value&&typeof value==='object'&&'success' in value){if(!value.success)throw value;return value.data;}return value as T;
  }
  protected async validate(){
    if(this.busy())return;this.reset();if(!this.branch.selectedBranchCode()||this.branch.selectedBranchCode()==='ALL'){this.error.set('Select a specific branch before importing.');return;}
    if(!this.file||!this.file.name.toLowerCase().endsWith('.csv')){this.error.set('Choose a UTF-8 CSV file.');return;}
    if(this.file.size>20*1024*1024){this.error.set('File exceeds 20 MB. Split it into smaller files.');return;}
    this.busy.set(true);try{this.preview.set(await this.request<ImportPreview>('/preview',{kind:this.kind,mode:this.kind==='STOCK'?'CREATE_ONLY':this.mode,fileName:this.file.name,csv:await this.file.text()}));}catch(e){this.error.set(this.message(e) || 'Validation failed. Please retry.');}finally{this.busy.set(false);}
  }
  protected async commit(){
    if(this.branch.selectedBranchCode()!==this.originalBranch){this.reset();this.error.set('The branch changed. Close and reopen the import screen.');return;}
    const p=this.preview();if(this.busy()||!p||p.status!=='READY'||!this.accepted())return;
    this.busy.set(true);this.error.set('');try{await this.request('/'+p.id+'/commit',{});this.preview.set({...p,status:'COMMITTED'});this.completed.emit();}catch(e){this.error.set(this.message(e)||'Import failed. Validate the file again before retrying.');this.preview.set(null);}finally{this.busy.set(false);}
  }
  protected async download(path:string,name:string){
    try{const blob=await firstValueFrom(this.http.get(this.base+'/pharmacy/imports/'+path,{responseType:'blob',withCredentials:true}));this.save(blob,name);}catch(e){this.error.set(this.message(e)||'Download failed.');}
  }
  protected async references(){
    try{const value=await firstValueFrom(this.http.get<any>(this.base+'/pharmacy/imports/reference-codes',{withCredentials:true}));const rows=value.data??value;const escape=(v:string)=>'"'+v.replace(/"/g,'""')+'"';this.save(new Blob(['\uFEFFColumn,Code,Name\r\n'+rows.map((r:any)=>[r.column,r.code,r.name].map(escape).join(',')).join('\r\n')],{type:'text/csv'}),'pharmacy-reference-codes.csv');}catch(e){this.error.set(this.message(e)||'Download failed.');}
  }
  private message(e:unknown):string{const body=(e as {error?:unknown})?.error??e;const safe={success:false,statusCode:0,message:'Request failed',data:null,correlationId:null,timestamp:'',errors:[],problem:null,...(typeof body==='object'&&body?body:{} )};return getApiErrorMessage(safe as ApiResponse<unknown>);}
  private save(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

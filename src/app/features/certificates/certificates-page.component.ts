import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';

interface Response<T> { success: boolean; data: T | null; message: string; }
interface Template { id: string; name: string; category: string; body: string; guidance: string; fields: string[]; custom: boolean; }
interface Patient { id: string; name: string; mrn: string; address: string; sex: string; dateOfBirth: string; }
interface Doctor { id: string; name: string; registration: string; }
interface Row { id: string; number: number; title: string; patient: string; mrn: string; status: string; branch: string; createdAt: string; }
interface Document { id: string; number: number; patient_id: string; doctor_id: string; template_id: string; title: string; body: string; status: string; version: number; fields: Record<string,string>; snapshot: Record<string,string>; issued_at: string | null; created_at: string; cancelled_at: string | null; cancellation_reason: string; }

@Component({ selector: 'app-certificates-page', standalone: true, imports: [CommonModule, FormsModule, A11yModule, AcDropdownComponent], templateUrl: './certificates-page.component.html', styleUrl: './certificates-page.component.css' })
export class CertificatesPageComponent {
  private readonly api = inject(ApiClientService);
  protected readonly auth = inject(AuthStore);
  protected readonly branch = inject(BranchContextService);
  protected readonly dialogs = inject(DialogService);
  protected readonly templates = signal<Template[]>([]);
  protected readonly rows = signal<Row[]>([]);
  protected readonly patients = signal<Patient[]>([]);
  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly saved = signal<Document | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly tab = signal<'templates'|'register'>('templates');
  protected readonly templateQuery = signal('');
  protected readonly category = signal('All');
  protected readonly selected = signal<Template | null>(null);
  protected readonly filtered = computed(() => this.templates().filter(t => (this.category() === 'All' || t.category === this.category()) && (t.name+' '+t.category).toLowerCase().includes(this.templateQuery().toLowerCase())));
  protected readonly categories = computed(() => ['All', ...new Set(this.templates().map(t => t.category))]);
  protected readonly categoryOptions = computed(() => this.categories().map(c => ({label:c === 'All' ? 'All categories' : c,value:c})));
  protected readonly doctorOptions = computed(() => this.doctors().map(d => ({label:`${d.name} · ${d.registration || 'Registration missing'}`,value:d.id})));
  protected readonly patientOptions = computed(() => {
    const options = this.patients().map(p => ({label:`${p.name} · ${p.mrn}`,value:p.id}));
    const saved = this.saved();
    if(saved && !options.some(p => p.value === saved.patient_id))options.push({label:`${saved.snapshot['patientName']} · ${saved.snapshot['mrn']}`,value:saved.patient_id});
    return options;
  });
  protected readonly customCount = computed(() => this.templates().filter(t => t.custom).length);
  protected readonly statusOptions = [{label:'All statuses',value:''},{label:'Draft',value:'DRAFT'},{label:'Issued',value:'ISSUED'},{label:'Cancelled',value:'CANCELLED'}];
  protected patientSearch = ''; protected registerSearch = ''; protected status = ''; protected page = 1; protected total = 0;
  protected patientId = ''; protected doctorId = ''; protected fields: Record<string,string> = {};
  protected confirmed = false; protected reason = ''; protected showCustom = false;
  protected customName = ''; protected customBody = ''; protected customGuidance = '';
  protected dirty = false;
  private generation = 0;
  private patientGeneration = 0;
  private registerGeneration = 0;
  private draftId = crypto.randomUUID();
  constructor() {
    effect(() => { this.branch.selectedBranchCode(); this.generation++; this.selected.set(null); this.saved.set(null); this.fields = {}; this.dirty = false; this.patients.set([]); this.doctors.set([]); this.rows.set([]); void this.load(); });
  }
  protected allowed(action: string) { return this.auth.hasPermission('Certificates.' + action); }
  protected editorDisabled() { return this.busy() || !this.specificBranch() || !this.allowed(this.saved() ? 'Edit' : 'Create'); }
  protected categoryIcon(category: string) { return ({'General':'description','Fitness':'health_and_safety','Leave & recovery':'medical_services','Travel':'flight','Hospital records':'local_hospital','Custom':'edit_note'} as Record<string,string>)[category] || 'article'; }
  protected templateExcerpt(t: Template) { return t.body.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,(_,key: string) => `[${this.label(key).toLowerCase()}]`); }
  protected previewPatient() { const saved=this.saved(); if(saved && !this.dirty)return {name:saved.snapshot['patientName'],mrn:saved.snapshot['mrn']}; const p = this.patients().find(p => p.id === this.patientId); return {name:p?.name || saved?.snapshot['patientName'] || 'Select a patient',mrn:p?.mrn || saved?.snapshot['mrn'] || '—'}; }
  protected previewDoctor() { const saved=this.saved(); if(saved && !this.dirty)return {name:saved.snapshot['doctorName'],registration:saved.snapshot['registration']}; const d = this.doctors().find(d => d.id === this.doctorId); return {name:d?.name || saved?.snapshot['doctorName'] || 'Certifying doctor',registration:d?.registration || saved?.snapshot['registration'] || '—'}; }
  protected specificBranch() { const code = this.branch.selectedBranchCode(); return !!code && !['ALL','NONE'].includes(code); }
  private async request<T>(method: 'get'|'post'|'put', path: string, body?: unknown): Promise<T> {
    const response = await firstValueFrom(method === 'get' ? this.api.get<Response<T>>(path) : method === 'put' ? this.api.put<Response<T>>(path,body) : this.api.post<Response<T>>(path,body));
    if (!response.success || response.data == null) throw new Error(response.message?.startsWith('Common.') ? 'The request failed. Check your connection or refresh the page.' : response.message || 'Unable to complete the request.');
    return response.data;
  }
  protected async load() {
    const generation = this.generation; this.error.set(''); this.busy.set(true);
    try {
      const [templates, doctors] = await Promise.all([this.request<Template[]>('get','/certificates/templates'),this.request<Doctor[]>('get','/certificates/doctors')]);
      if (generation !== this.generation) return;
      this.templates.set(templates); this.doctors.set(doctors); await this.loadRegister();
    } catch (e) { if (generation === this.generation) this.error.set((e as Error).message); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  protected async loadRegister(reset = false) {
    if (reset) this.page = 1;
    const generation = this.generation, request = ++this.registerGeneration;
    try { const data = await this.request<{items:Row[];total:number}>('get',`/certificates?search=${encodeURIComponent(this.registerSearch)}&status=${encodeURIComponent(this.status)}&page=${this.page}`); if(generation !== this.generation || request !== this.registerGeneration)return; this.rows.set(data.items); this.total = data.total; }
    catch(e) { if(generation === this.generation)this.error.set((e as Error).message); }
  }
  protected async searchPatients() {
    const generation = this.generation, request = ++this.patientGeneration;
    try { const patients = await this.request<Patient[]>('get','/certificates/patients?search='+encodeURIComponent(this.patientSearch)); if(generation === this.generation && request === this.patientGeneration)this.patients.set(patients); }
    catch(e) { this.error.set((e as Error).message); }
  }
  protected async choose(t: Template) {
    if(!await this.confirmDiscard())return;
    this.selected.set(t); this.saved.set(null); this.fields = { hospitalName: this.branch.hospitalName(), examDate: this.today(), identificationMark: '', address: '' };
    this.patientId = ''; this.doctorId = ''; this.confirmed = false; this.reason = ''; this.dirty = false; this.error.set(''); this.notice.set(''); this.draftId = crypto.randomUUID();
    void this.searchPatients();
  }
  protected selectPatient() { const p = this.patients().find(p => p.id === this.patientId); if(p) { this.fields['patientName'] = p.name; this.fields['address'] = p.address; this.fields['sex'] = p.sex; } this.change(); }
  protected change() { this.dirty = true; this.confirmed = false; }
  protected editableFields() { return this.selected()?.fields.filter(f => !['patientName','doctorName','mrn','doctorRegistration','hospitalName','address','identificationMark'].includes(f)) ?? []; }
  protected label(key: string) { return key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()); }
  protected fieldType(key: string) { return /Date$/.test(key) ? 'date' : 'text'; }
  protected preview() { const t = this.selected(); const p = this.patients().find(p => p.id === this.patientId); const d = this.doctors().find(d => d.id === this.doctorId); const values = {...this.fields,patientName:p?.name ?? this.fields['patientName'] ?? '',doctorName:d?.name ?? '',mrn:p?.mrn ?? '',doctorRegistration:d?.registration ?? ''}; return (t?.body ?? '').replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,(m,key: string)=>values[key as keyof typeof values] || m); }
  protected async save() {
    if(!this.patientId || !this.doctorId || !this.selected()) { this.error.set('Choose a patient and doctor.'); return; }
    await this.work(async () => { const old = this.saved(); const result = await this.request<{id:string}>(old ? 'put':'post','/certificates'+(old?'/'+old.id:''),{id:old?.id ?? this.draftId,patientId:this.patientId,doctorId:this.doctorId,templateId:this.selected()!.id,fields:this.fields,version:old?.version ?? 0}); await this.open(result.id,true); this.notice.set('Draft saved. Review the saved preview before issuing.'); await this.loadRegister(); });
  }
  protected async open(id: string, force = false) {
    if(!force && !await this.confirmDiscard())return;
    const generation = this.generation;
    try { const d = await this.request<Document>('get','/certificates/'+id); if(generation !== this.generation)return; this.saved.set(d); this.selected.set(this.templates().find(t=>t.id===d.template_id) ?? {id:d.template_id,name:d.title,body:d.body,fields:[],category:'Archived',guidance:d.snapshot['guidance'],custom:false}); this.fields = {...d.fields}; this.patientId = d.patient_id; this.doctorId = d.doctor_id; this.dirty = false; this.confirmed = false; this.reason = ''; }
    catch(e) { this.error.set((e as Error).message); }
  }
  protected async issue() { const d = this.saved(); if(!d || this.dirty)return; await this.work(async()=>{await this.request('post',`/certificates/${d.id}/issue`,{version:d.version,confirmed:this.confirmed}); await this.open(d.id,true); await this.loadRegister(); this.notice.set('Certificate issued. The saved content is now locked.');}); }
  protected async cancel() { const d = this.saved(); if(!d)return; await this.work(async()=>{await this.request('post',`/certificates/${d.id}/cancel`,{version:d.version,reason:this.reason}); await this.open(d.id,true); await this.loadRegister(); this.notice.set('Certificate cancelled; retained in the register.');}); }
  protected async saveTemplate() { await this.work(async()=>{await this.request('post','/certificates/templates',{id:crypto.randomUUID(),name:this.customName,body:this.customBody,guidance:this.customGuidance}); this.showCustom=false; this.customName=''; this.customBody=''; this.customGuidance=''; await this.load(); this.notice.set('Custom template added to this branch.');}); }
  private async work(action:()=>Promise<void>) { if(this.busy())return; this.busy.set(true); this.error.set(''); this.notice.set(''); try {await action();}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);} }
  protected async next(delta:number) { this.page+=delta; await this.loadRegister(); }
  protected async close() { if(!await this.confirmDiscard())return; this.selected.set(null); this.saved.set(null); this.dirty=false; }
  private async confirmDiscard() {
    if(this.dialogs.dialog())return false;
    return !this.dirty || await this.dialogs.confirmDiscard('You have unsaved certificate changes. Discard them or keep editing this certificate.');
  }
  hasUnsavedChanges() { return this.dirty; }
  unsavedChangesMessage() { return 'You have unsaved certificate changes. Discard them or keep editing this certificate.'; }
  @HostListener('window:beforeunload', ['$event']) protected beforeUnload(event: BeforeUnloadEvent) { if(this.dirty){event.preventDefault();event.returnValue='';} }
  protected escape(event: Event) { event.stopPropagation(); if(this.selected() && !this.busy() && !this.dialogs.dialog())void this.close(); }
  protected print() {
    const d = this.saved(); if(!d || this.dirty)return;
    const esc = (s:unknown) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    const frame = document.createElement('iframe'); frame.style.position='fixed';frame.style.width='0';frame.style.height='0';frame.style.border='0';document.body.appendChild(frame);
    const doc = frame.contentDocument!; const s=d.snapshot;
    doc.open();doc.write(`<!doctype html><html><head><title>Certificate ${esc(d.number)}</title><style>@page{size:A4;margin:20mm}body{font:11pt Arial,Helvetica,sans-serif;color:#26345a;line-height:1.8}*{box-sizing:border-box}header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:20px;color:#172554}h1{font-size:22pt;letter-spacing:-.5pt;margin:0 0 6px}h2{text-align:center;margin:30px 0;font-size:16pt;color:#172554}article{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:48px;border-top:1px solid #e3e7f1;padding-top:18px}.meta{display:flex;justify-content:space-between;font-size:10pt;margin:20px 0}.status{font-size:16pt;color:#991b1b;text-align:center;border:1px solid #fecaca;padding:10px}small{font-size:9pt}</style></head><body><header><h1>${esc(s['hospitalName'])}</h1>${esc(s['branch'])}</header>${d.status!=='ISSUED'?`<p class="status">${esc(d.status)} — NOT VALID FOR USE</p>`:''}<h2>${esc(d.title)}</h2><div class="meta"><span>Certificate: CERT-${esc(d.number)}</span><span>Date: ${esc(new Date(d.issued_at ?? d.created_at).toLocaleDateString())}</span></div><p>Patient: ${esc(s['patientName'])} · UHID: ${esc(s['mrn'])}<br>Address: ${esc(s['address'])}<br>Identification mark: ${esc(d.fields['identificationMark'])}</p><article>${esc(d.body)}</article><footer><p>_________________________<br>Dr. ${esc(s['doctorName'])}<br>${esc(s['qualification'])}<br>Registration: ${esc(s['registration'])}</p><p>Patient signature / thumb impression: _________________________</p><small>${esc(s['guidance'])}</small>${d.status==='CANCELLED'?`<p>Cancellation: ${esc(d.cancellation_reason)}</p>`:''}</footer></body></html>`);doc.close();
    setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000);},250);
  }
  private today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { DigitalPrescription, DigitalVisit, PrescriptionAccessService } from './prescription-access.service';

@Component({
  standalone: true, imports: [CommonModule, FormsModule, RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="portal">
      <header class="brand"><a href="/">Auspira Care360</a><span>Secure patient records</span></header>
      @if (!record()) {
        <section class="entry">
          <div class="symbol" aria-hidden="true">Rx</div><p class="eyebrow">DIGITAL PRESCRIPTION</p>
          <h1>Your care, in one place</h1><p>View your prescription and previous completed visits securely.</p>
          @if (!validLink) { <p role="alert" class="error">This link is incomplete. Scan the QR on your prescription again.</p> }
          @else {
            <form (ngSubmit)="open(false)"><label for="access-code">Patient access code</label>
              <input id="access-code" name="code" [(ngModel)]="code" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{8}" placeholder="8-digit code" required />
              <p class="hint">Enter the separate code provided by your hospital. It is not printed on the prescription.</p>
              <button type="submit" [disabled]="busy()">{{ busy() ? 'Opening records…' : 'View my records' }}</button>
            </form>
            <div class="staff"><strong>Hospital staff</strong>
              @if (auth.isAuthenticated()) { <button type="button" class="secondary" [disabled]="busy()" (click)="open(true)">Open using hospital login</button> }
              @else { <a class="secondary" routerLink="/auth/login" [queryParams]="{ returnUrl: returnUrl }">Sign in to hospital account</a> }
            </div>
          }
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <p class="hint">Access expires after 30 days. Contact the hospital for a new link or code.</p>
        </section>
      } @else { @if (selected(); as visit) {
        <nav class="tools"><span>Verified access · Read-only record</span><div><button class="secondary" (click)="print()">Print / Save PDF</button><button class="secondary" (click)="close()">Close records</button></div></nav>
        <div class="layout">
          <article class="document">
            <header class="hospital"><p class="eyebrow">OUTPATIENT PRESCRIPTION</p><h1>{{ record()!.hospitalName }}</h1>
              @if (record()!.address; as address) { <p>{{ address.addressLine1 }} {{ address.addressLine2 }} · {{ address.cityName }}, {{ address.stateName }} {{ address.postalCode }}</p> }
              @if (record()!.contact; as contact) { <p>{{ contact.primaryPhone }} · {{ contact.email }}</p> }
            </header>
            <section class="doctor"><h2>{{ visit.doctorName }}</h2><p>{{ visit.qualification }} · {{ visit.department }}</p><p>Registration no. {{ visit.registrationNo || 'Not recorded' }}</p></section>
            <section class="identity"><div><small>PATIENT</small><h2>{{ visit.patientName }}</h2><p>{{ visit.age ?? '—' }} years · {{ gender(visit.gender) }} · {{ visit.mrn }}</p></div><div><small>VISIT DATE</small><strong>{{ visit.visitDate | date:'dd MMM yyyy, h:mm a':'+0530' }}</strong><p>{{ visit.clinical.prescriptionNo || 'OPD prescription' }} · {{ status(visit.status) }}</p></div></section>
            @if (visit.status !== 'COMPLETED') { <p class="notice">This consultation is still in progress. Treatment may change until the doctor completes it.</p> }
            @if (visit.clinical.vitals; as vitals) { <section class="vitals">@for (vital of vitalRows(vitals); track vital.label) { <div><small>{{ vital.label }}</small><strong>{{ vital.value || '—' }} <span>{{ vital.unit }}</span></strong></div> }</section> }
            <section class="clinical"><h3>Complaints & diagnosis</h3>
              @for (complaint of visit.clinical.complaints || []; track $index) { <p>{{ complaint.complaint }} <span class="muted">{{ complaint.duration }} · {{ complaint.severity }}</span></p> }
              @for (diagnosis of visit.clinical.diagnoses || []; track $index) { <p><strong>{{ diagnosis.diagnosisName }}</strong> <span class="badge">{{ diagnosis.diagnosisType === 'PRIMARY' ? 'Primary diagnosis' : 'Secondary diagnosis' }}</span></p> }
            </section>
            <section class="medicines"><h2 class="rx">Rx <span>Medicines prescribed</span></h2>
              @for (medicine of visit.clinical.prescriptions || []; track $index) { <article><div class="medicine-title"><span>{{ $index + 1 }}</span><h3>{{ medicine.medicine }} <small>{{ medicine.strength }} · {{ medicine.dosageForm }}</small></h3></div>
                <div class="schedule"><div><small>DOSE</small><strong>{{ medicine.dosage }}</strong></div><div><small>FREQUENCY</small><strong>{{ frequency(medicine.frequency) }}</strong></div><div><small>ROUTE</small><strong>{{ medicine.route }}</strong></div><div><small>DURATION</small><strong>{{ duration(medicine.duration) }}</strong></div><div><small>QUANTITY</small><strong>{{ medicine.quantity }}</strong></div></div>
                @if (medicine.instructions) { <p>{{ medicine.instructions }}</p> } @if (medicine.isPrn) { <p>As needed: {{ medicine.prnReason }}</p> }
              </article> } @empty { <p class="muted">{{ visit.legacyNotes ? 'Medicine details are in the original consultation record below.' : 'No medicines recorded for this visit.' }}</p> }
            </section>
            <div class="extras"><section><h3>Investigations</h3>@for (item of investigations(visit); track $index) { <p>{{ item }}</p> } @empty { <p class="muted">None recorded</p> }</section><section><h3>Advice</h3>@for (item of visit.clinical.adviceList || []; track $index) { <p>{{ item }}</p> }@for (item of visit.clinical.dietAdviceList || []; track $index) { <p>{{ item }}</p> }</section></div>
            @if (visit.clinical.procedures?.length) { <section class="clinical"><h3>Procedures</h3>@for (procedure of visit.clinical.procedures || []; track $index) { <p>{{ procedure.procedure }} · {{ procedure.notes }}</p> }</section> }
            @if (visit.clinical.followUp?.followUpRequired) { <section class="follow"><h3>Next visit</h3><strong>{{ visit.clinical.followUp!.followUpDate | date:'dd MMM yyyy' }}</strong><p>{{ visit.clinical.followUp!.reason }}</p><p>{{ visit.clinical.followUp!.notes }}</p><small>{{ visit.clinical.followUp!.createAppointment ? 'An appointment was requested. Confirm the time with the hospital.' : 'Please contact the hospital to book your follow-up.' }}</small></section> }
            <details class="clinical"><summary>Clinical history & examination</summary>
              @for (line of clinicalHistory(visit); track $index) { <p>{{ line }}</p> } @empty { <p>No additional history recorded.</p> }
            </details>
            @if (visit.legacyNotes) { <section class="clinical"><h3>Original consultation record</h3><pre>{{ visit.legacyNotes }}</pre></section> }
            <footer class="document-foot">Issued by {{ visit.doctorName }} · Registration {{ visit.registrationNo || 'not recorded' }}<p>Use medicines as directed by your treating doctor. This digital record does not contain a handwritten signature.</p></footer>
          </article>
          <aside class="history"><p class="eyebrow">CARE TIMELINE</p><h2>Visit history</h2><p class="muted">Previous completed visits at this hospital.</p><div class="history-visits">@for (item of record()!.visits; track item.id) { <button class="visit" [class.active]="item.id === visit.id" (click)="selected.set(item)"><strong>{{ item.visitDate | date:'dd MMM yyyy' }}</strong><span>{{ item.doctorName }}</span><span>{{ status(item.status) }}</span>@if (item.id === record()!.selectedId) { <small>Scanned prescription</small> }</button> }</div></aside>
        </div>
      } }
    </main>`,
  styles: [`
    :host{display:block;color:#172554;background:#f5f6fb;min-height:100dvh;font-family:Arial,sans-serif}*{box-sizing:border-box}.portal{max-width:1260px;margin:auto;padding:24px}a{color:#5131be;text-decoration:none}.brand,.tools,.medicine-title{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{padding-bottom:24px}.brand a{font-size:20px;font-weight:800}.brand span,.muted,.hint{color:#61718b}.entry{max-width:480px;margin:5vh auto;background:white;padding:32px;border:1px solid #e2e7f2;border-radius:22px;box-shadow:0 18px 45px #2924540d}.entry h1{font-size:28px;margin:10px 0}.entry p{line-height:1.6}.symbol{font-size:36px;font-family:Georgia,serif;color:#6438d8}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:#6937d3}form{display:grid;gap:12px;margin:24px 0}label{font-weight:bold}input{height:50px;border:1px solid #bdc9df;border-radius:10px;padding:12px;font-size:20px;letter-spacing:.18em;width:100%}button,.secondary{cursor:pointer;border-radius:10px;padding:12px 16px;font:inherit;background:#5839cb;color:white;border:1px solid transparent;text-align:center}button:disabled{opacity:.6;cursor:wait}.secondary{display:inline-block;background:white;border-color:#dce3f1;color:#263658}.staff{display:grid;gap:12px;border-top:1px solid #e5e9f2;padding-top:20px}.hint{font-size:13px;margin:0}.error,.notice{background:#fff4eb;color:#9a3412;padding:14px;border-radius:10px}.tools{margin-bottom:20px;font-size:13px}.tools div{display:flex;gap:10px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:24px;align-items:start}.document{background:white;border:1px solid #e1e6f0;border-radius:16px;overflow:hidden;min-width:0}.hospital{padding:28px;text-align:center;border-top:5px solid #643bd4}.hospital h1{font-size:28px;margin:8px 0}.hospital p,.doctor p{font-size:13px;line-height:1.6;margin:5px 0}.doctor{padding:18px 28px;background:#f6f5fc;text-align:center}.doctor h2{margin:0;font-size:21px}.identity{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:24px 28px;border-bottom:1px solid #e4e8f1}.identity h2{margin:6px 0;font-size:21px}.identity p{margin:6px 0;font-size:13px}.identity strong{display:block;margin-top:7px}small{color:#63738b;font-size:11px}.vitals{display:grid;grid-template-columns:repeat(4,1fr);padding:18px 28px;gap:18px;background:#fafbff}.vitals div{display:grid;gap:6px}.vitals strong{font-size:14px}.vitals span{font-weight:normal;font-size:11px}.clinical,.medicines,.follow,.document-foot{padding:22px 28px;border-top:1px solid #e4e8f1}h3{font-size:15px;margin:0 0 10px}p{line-height:1.6}.clinical p{margin:7px 0;font-size:14px}.badge{background:#f0ebff;color:#6236b5;border-radius:6px;padding:4px 7px;font-size:10px}.rx{font-family:Georgia,serif;font-size:30px;margin:0 0 20px}.rx span{font:600 15px Arial,sans-serif;padding-left:10px}.medicines article{border:1px solid #e3e7f1;border-radius:10px;padding:16px;margin:12px 0;break-inside:avoid}.medicine-title{justify-content:flex-start}.medicine-title>span{background:#eeeaff;color:#6037bf;border-radius:8px;padding:8px}.medicine-title h3{margin:0;font-size:16px}.medicine-title small{display:block;margin-top:5px}.schedule{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px}.schedule div{display:grid;gap:6px}.schedule strong{font-size:13px}.medicines article p{font-size:13px;margin-bottom:0}.extras{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e4e8f1}.extras section{padding:22px 28px}.extras p{font-size:14px;margin:6px 0}.follow{background:#f5faf8}.follow strong{color:#067560}.document-foot{font-size:12px;color:#5b6c83}.history{border:1px solid #e1e6f0;background:white;border-radius:16px;padding:20px}.history h2{font-size:20px}.history p{font-size:12px}.visit{display:grid;gap:7px;width:100%;text-align:left;background:white;color:#25345c;border:1px solid #e0e6f1;margin:12px 0;font-size:13px}.visit.active{border-color:#7b4bea;background:#f5f0ff}.visit span{font-size:12px;color:#61718b}summary{cursor:pointer;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px Arial,sans-serif;line-height:1.7}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #6239d2;outline-offset:3px}
    @media(max-width:900px){.layout{grid-template-columns:1fr}.history{order:-1}.history-visits{display:flex;gap:10px;overflow-x:auto;padding:6px 0;scrollbar-width:thin}.history .visit{display:grid;flex:0 0 160px;width:160px;margin:0}.history h2{margin:8px 0}.history>p{margin:5px 0}}@media(max-width:540px){.portal{padding:14px}.brand{align-items:flex-start}.brand a{font-size:17px}.brand span{font-size:11px}.entry{padding:24px;margin:20px auto}.tools{align-items:flex-start;flex-direction:column}.hospital,.doctor,.identity,.vitals,.clinical,.medicines,.follow,.document-foot,.extras section{padding:18px}.hospital h1{font-size:24px}.identity,.extras{grid-template-columns:1fr}.vitals{grid-template-columns:repeat(2,1fr)}.schedule{grid-template-columns:repeat(2,1fr)}.schedule strong{overflow-wrap:anywhere}}
    @media print{.brand,.tools,.history{display:none}.portal{padding:0}.layout{display:block}.document{border:0;border-radius:0}.hospital{border-top:0}details{display:block}details>p{display:block}.schedule{grid-template-columns:repeat(5,1fr)}.identity,.extras{grid-template-columns:1fr 1fr}@page{size:A4;margin:12mm}}
  `]
})
export class PrescriptionAccessPageComponent {
  protected readonly auth = inject(AuthStore);
  private readonly service = inject(PrescriptionAccessService);
  private readonly params = new URLSearchParams(location.hash.slice(1));
  private readonly token = this.params.get('token') || '';
  private readonly tenant = this.params.get('tenant') || '';
  protected readonly validLink = Boolean(this.token && this.tenant);
  protected readonly returnUrl = '/prescription-access' + location.hash;
  protected readonly record = signal<DigitalPrescription | null>(null);
  protected readonly selected = signal<DigitalVisit | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected code = '';
  protected async open(staff: boolean): Promise<void> {
    if (this.busy() || !this.validLink) return;
    this.busy.set(true); this.error.set('');
    try {
      const record = await this.service.records(this.token, this.tenant, this.code.trim(), staff);
      this.record.set(record); this.selected.set(record.visits.find(item => item.id === record.selectedId) || null); this.code = '';
    } catch (error: any) {
      this.error.set(error.status === 429 ? 'Too many attempts. Wait 15 minutes before trying again.' : error.status === 401 ? 'The code or login is invalid. Please check and try again.' : 'The record is unavailable, not completed, or the link has expired. Please contact the hospital.');
    } finally { this.busy.set(false); }
  }
  protected close(): void { this.record.set(null); this.selected.set(null); this.code = ''; }
  protected print(): void { window.print(); }
  protected investigations(visit: DigitalVisit): string[] { return [...new Set([...(visit.clinical.prescriptionInvestigations || []), ...(visit.investigations || [])])]; }
  protected duration(value: string): string { return /^\d+(?:\.\d+)?$/.test(value.trim()) ? value.trim() + ' days' : value; }
  protected gender(value: string): string { return ({ M: 'Male', F: 'Female', O: 'Other', MALE: 'Male', FEMALE: 'Female' } as Record<string,string>)[value] || value || 'Not recorded'; }
  protected status(value: string): string { return value === 'COMPLETED' ? 'Completed' : 'In progress'; }
  protected frequency(value: string): string { return ({ OD: 'Once daily', BD: 'Twice daily', TDS: 'Three times daily', QID: 'Four times daily', HS: 'At bedtime', PRN: 'As needed', STAT: 'Immediately' } as Record<string,string>)[value] || value; }
  protected vitalRows(vitals: any): { label: string; value: string; unit: string }[] {
    return [['Blood pressure','bloodPressure','mmHg'],['Pulse','pulseRate','bpm'],['Temperature','temperature','°F'],['Oxygen saturation','spo2','%'],['Respiration','respiratoryRate','/min'],['Height','height','cm'],['Weight','weight','kg']].map(([label,key,unit]) => ({ label, value: vitals[key], unit }));
  }
  protected clinicalHistory(visit: DigitalVisit): string[] {
    const clinical = visit.clinical;
    return Object.entries({ 'Present illness': clinical.history?.presentIllness, 'Past history': clinical.history?.pastHistory, 'Family history': clinical.history?.familyHistory, 'Surgical history': clinical.history?.surgicalHistory, 'General examination': clinical.examination?.generalExamination, 'System examination': clinical.examination?.systemExamination, 'Observations': clinical.examination?.observations }).filter(([,value]) => value?.trim()).map(([label,value]) => `${label}: ${value}`);
  }
}

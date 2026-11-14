import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { BookingConfirmation, BookingSlot, OnlineBookingService, PublicBookingProfile } from './online-booking.service';

@Component({standalone:true,imports:[CommonModule,FormsModule,AcDropdownComponent],changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <main class="public-booking">
  <header class="ac-card"><img class="auth-wordmark" src="assets/brand/auspira-logo.webp" alt="Auspira Technologies" width="48" height="48" /><div><p class="ac-eyebrow">Online appointment booking</p><h1>{{ profile()?.title || 'Book an appointment' }}</h1><p>{{ profile()?.hospitalName }}</p></div></header>
  @if (loading()) { <p role="status">Loading available appointments…</p> }
  @if (error()) { <div class="feedback" role="alert">{{ error() }}</div> }
  @if (profile(); as p) {
   <section class="ac-card">@if(p.bookingEnabled===false){<p role="status">New bookings are paused. You can still manage an existing appointment or contact reception.</p>}<p>{{ p.address }}</p><p>{{ p.instructions }}</p><p>Need help? {{ p.phone }}</p><p>For an emergency, contact the hospital directly. Online booking is for scheduled consultations.</p></section>
   <nav class="booking-tabs" aria-label="Booking options"><button class="ac-btn" [class.ac-btn-primary]="!managing()" [disabled]="profile()?.bookingEnabled===false" (click)="changeMode(false)">Book appointment</button><button class="ac-btn" [class.ac-btn-primary]="managing()" (click)="changeMode(true)">Manage my booking</button></nav>
   @if (!confirmation()) {
    @if (managing()) {
     <section class="ac-card form-grid"><h2>Find your booking</h2><label>Booking ID<input class="ac-input" [(ngModel)]="manageId" placeholder="From your confirmation" /></label></section>
    } @else {
     <section class="ac-card"><h2>1. Choose a doctor and time</h2><div class="form-grid"><label>Doctor<ac-dropdown ariaLabel="Choose doctor" name="doctor" [(ngModel)]="doctorId" [options]="doctorOptions()" [disabled]="busy()" (ngModelChange)="loadSlots()" /></label><label>Date<input class="ac-input" type="date" [disabled]="busy()" [(ngModel)]="day" [min]="today" (ngModelChange)="loadSlots()" /></label><label>Visit type<ac-dropdown ariaLabel="Visit type" name="visitType" [(ngModel)]="visitType" [options]="visitOptions" /></label></div>
      <button class="ac-btn ac-btn-secondary" [disabled]="busy()||!doctorId" (click)="nextAvailable()">Find next available time</button><div class="slots" aria-label="Available appointment slots">@for (slot of slots(); track slot.id) { <button class="ac-btn" [class.ac-btn-primary]="selectedSlot()?.id===slot.id" [disabled]="busy()" (click)="selectSlot(slot)">{{ slot.startsAt | date:'shortTime' }}</button> } @empty { <p>No published slots on this date. Choose another day or contact reception.</p> }</div>
      @if (selectedSlot()) { <p role="status">Selected: {{ selectedSlot()!.startsAt | date:'medium' }} · {{ zone }}. Reservation expires {{ holdExpires() | date:'shortTime' }}.</p> }
     </section>
    }
    <section class="ac-card"><h2>{{ managing() ? 'Verify your contact' : '2. Your booking details' }}</h2><p>Booking does not create a patient record. Reception will verify your identity and complete registration when you arrive.</p>
     <div class="form-grid">
      @if (!managing()) {
       <label>Attendee full name<input class="ac-input" autocomplete="name" [(ngModel)]="name" maxlength="150" /></label>
       <label>Booked by (if different)<input class="ac-input" [(ngModel)]="bookerName" maxlength="150" /></label>
       <label>Relationship to attendee<input class="ac-input" [(ngModel)]="relationship" maxlength="50" /></label>
      }
      <label>Contact phone<input class="ac-input" type="tel" autocomplete="tel" [(ngModel)]="phone" placeholder="+91…" [disabled]="!!challengeId()" /></label>
     </div>
     <label class="consent"><input type="checkbox" [(ngModel)]="consent" />I agree to receive verification and appointment service messages at this number.</label>
     @if (!verified()) {
      <div class="actions"><button class="ac-btn ac-btn-secondary" [disabled]="busy()||!consent||!phone||(!managing()&&!holdId())" (click)="requestCode()">{{ challengeId() ? 'Request another code' : 'Send verification code' }}</button>
       @if (challengeId()) { <label>Verification code<input class="ac-input" inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="code" maxlength="6" /></label><button class="ac-btn ac-btn-primary" [disabled]="busy()||code.length!==6" (click)="verify()">Verify phone</button> }
      </div>
     } @else { <p role="status">Contact verified. Reception will separately verify the attendee’s identity.</p> }
     <button class="ac-btn ac-btn-primary" [disabled]="busy()||!verified()||(!managing()&&(!name.trim()||!holdId()))" (click)="managing()?lookup():confirm()">{{ busy()?'Please wait…':managing()?'Find booking':'Confirm appointment' }}</button>
    </section>
   } @else {
    <section class="ac-card confirmation" role="status"><p class="ac-eyebrow">Appointment {{ confirmation()!.status.toLowerCase().replaceAll('_',' ') }}</p><h2>{{ confirmation()!.reference }}</h2><p>{{ confirmation()!.name }}</p><p>{{ confirmation()!.startsAt | date:'fullDate' }} · {{ confirmation()!.startsAt | date:'shortTime' }} ({{ zone }})</p><p>{{ p.hospitalName }} · {{ p.address }}</p><p>Booking ID: {{ confirmation()!.id }}</p><p>Save this confirmation and bring it to reception. This reference does not replace patient registration.</p><div class="actions"><button class="ac-btn ac-btn-secondary" (click)="calendar()">Add to calendar</button><button class="ac-btn ac-btn-secondary" (click)="saveSlip()">Download confirmation</button><button class="ac-btn ac-btn-secondary" (click)="printConfirmation()">Print / save PDF</button><button class="ac-btn ac-btn-secondary" [disabled]="busy()||confirmation()!.status==='CANCELLED'" (click)="cancel()">Cancel appointment</button><button class="ac-btn ac-btn-secondary" [disabled]="busy()||!['SCHEDULED','CONFIRMED'].includes(confirmation()!.status)" (click)="startReschedule()">Reschedule</button></div>
     @if (rescheduling()) { <label>New date<input class="ac-input" type="date" [(ngModel)]="day" [min]="today" (ngModelChange)="loadSlots()" /></label><div class="slots">@for(slot of slots();track slot.id){<button class="ac-btn ac-btn-secondary" (click)="selectSlot(slot)">{{ slot.startsAt|date:'shortTime' }}</button>}</div><button class="ac-btn ac-btn-primary" [disabled]="busy()||!holdId()" (click)="reschedule()">Confirm new time</button> }
    </section>
   }
  }
 </main>`,styleUrl:'./online-booking.css'})
export class PublicBookingPageComponent implements OnInit,OnDestroy {
 readonly api=inject(OnlineBookingService);readonly route=inject(ActivatedRoute);
 readonly profile=signal<PublicBookingProfile|null>(null);readonly slots=signal<BookingSlot[]>([]);readonly selectedSlot=signal<BookingSlot|null>(null);
 readonly error=signal('');readonly loading=signal(true);readonly busy=signal(false);readonly managing=signal(false);readonly rescheduling=signal(false);
 readonly holdId=signal('');readonly holdExpires=signal('');readonly challengeId=signal('');readonly verified=signal(false);readonly confirmation=signal<BookingConfirmation|null>(null);
 readonly zone=Intl.DateTimeFormat().resolvedOptions().timeZone;readonly today=this.localDay();day=this.today;
 doctorId='';name='';phone='';bookerName='';relationship='';visitType='NEW_CONSULTATION';code='';consent=false;manageId='';
 readonly visitOptions:DropdownOption<string>[]=[{label:'New consultation',value:'NEW_CONSULTATION'},{label:'Follow-up',value:'FOLLOW_UP'}];
 private token='';private contactTicket='';private challengeAttempt='';private link='';private command='';private reservation='';private previousHold='';private reservationSlot='';private confirmSignature='';private generation=0;private destroyed=false;
 doctorOptions():DropdownOption<string>[] {return (this.profile()?.doctors??[]).map(d=>({label:d.name+(d.specialty?' · '+d.specialty:''),value:d.id}));}
 async ngOnInit(){this.link=this.route.snapshot.paramMap.get('link')??'';try{this.profile.set(await this.api.get('/public-booking/'+this.link));this.doctorId=this.profile()?.doctors[0]?.id??'';if(this.profile()?.bookingEnabled===false)this.managing.set(true);else await this.loadSlots();}catch(e){this.error.set(this.message(e));}finally{this.loading.set(false);}}
 ngOnDestroy(){this.destroyed=true;this.generation++;}
 async loadSlots(){const version=++this.generation;this.slots.set([]);this.selectedSlot.set(null);this.previousHold=this.holdId()||this.previousHold;this.holdId.set('');this.reservation='';this.reservationSlot='';if(!this.doctorId)return;try{const from=new Date(this.day+'T00:00:00'),to=new Date(from);to.setDate(to.getDate()+1);const slots=await this.api.post<BookingSlot[]>('/public-booking/'+this.link+'/slots',{doctorId:this.doctorId,from:from.toISOString(),to:to.toISOString()});if(!this.destroyed&&version===this.generation)this.slots.set(slots);}catch(e){if(version===this.generation)this.error.set(this.message(e));}}
 async nextAvailable(){await this.run(async()=>{const version=++this.generation;this.previousHold=this.holdId()||this.previousHold;this.holdId.set('');this.selectedSlot.set(null);const from=new Date(),to=new Date(from);to.setDate(to.getDate()+31);const result=await this.call<BookingSlot[]>('slots',{doctorId:this.doctorId,from:from.toISOString(),to:to.toISOString()});if(version!==this.generation||this.destroyed)return;if(!result.length){this.slots.set([]);this.error.set('No published appointments in the next 31 days. Please contact reception.');return;}const date=new Date(result[0].startsAt);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());this.day=date.toISOString().slice(0,10);this.slots.set(result.filter(s=>{const d=new Date(s.startsAt);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().startsWith(this.day);}));});}
 async selectSlot(slot:BookingSlot){if(this.busy())return;await this.run(async()=>{if(this.reservationSlot!==slot.id){this.reservation=crypto.randomUUID();this.reservationSlot=slot.id;}const generation=this.generation;const r=await this.call<{holdId:string;expiresAt:string}>('hold',{slotId:slot.id,slotRevision:slot.version,holdId:this.reservation,previousHoldId:this.holdId()||this.previousHold||undefined});if(generation!==this.generation)return;this.selectedSlot.set(slot);this.previousHold='';this.holdId.set(r.holdId);this.holdExpires.set(r.expiresAt);this.command='';});}
 async requestCode(){await this.run(async()=>{this.challengeAttempt ||= crypto.randomUUID();const id=this.challengeAttempt;const r=await this.call<{challengeId:string;contactTicket:string}>('challenge',{challengeId:id,phone:this.phone,messagingConsent:this.consent,appointmentId:this.managing()?this.manageId:undefined});this.challengeId.set(r.challengeId);this.contactTicket=r.contactTicket;this.challengeAttempt='';this.verified.set(false);this.token='';});}
 async verify(){await this.run(async()=>{this.token ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const r=await this.call<{verificationToken:string}>('verify',{challengeId:this.challengeId(),code:this.code,verificationToken:this.token});this.token=r.verificationToken;this.verified.set(true);});}
 async confirm(){await this.run(async()=>{const signature=JSON.stringify([this.holdId(),this.name,this.bookerName,this.relationship,this.visitType,this.challengeId()]);if(signature!==this.confirmSignature){this.command=crypto.randomUUID();this.confirmSignature=signature;}this.confirmation.set(await this.call<BookingConfirmation>('confirm',{...this.credentials(),commandId:this.command,holdId:this.holdId(),name:this.name,bookerName:this.bookerName,relationship:this.relationship,visitType:this.visitType}));});}
 async lookup(){await this.run(async()=>this.confirmation.set(await this.call('manage',{...this.credentials(),appointmentId:this.manageId})));}
 async cancel(){await this.run(async()=>{const r=await this.call<BookingConfirmation>('cancel',{...this.credentials(),appointmentId:this.confirmation()!.id});this.confirmation.update(c=>c?{...c,status:r.status}:c);});}
 async startReschedule(){this.doctorId=this.confirmation()?.doctorId??this.doctorId;this.rescheduling.set(true);this.holdId.set('');await this.loadSlots();}
 async reschedule(){await this.run(async()=>{this.command ||= crypto.randomUUID();this.confirmation.set(await this.call('reschedule',{...this.credentials(),commandId:this.command,appointmentId:this.confirmation()!.id,holdId:this.holdId()}));this.rescheduling.set(false);});}
 changeMode(manage:boolean){if(this.busy())return;this.managing.set(manage);this.confirmation.set(null);this.challengeId.set('');this.verified.set(false);this.code='';this.token='';this.contactTicket='';this.challengeAttempt='';this.error.set('');}
 calendar(){const c=this.confirmation();if(!c)return;const start=new Date(c.startsAt);const end=c.endsAt?new Date(c.endsAt):null;const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');this.download('appointment.ics','text/calendar','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Care360//Booking//EN\r\nBEGIN:VEVENT\r\nUID:'+c.id+'@care360\r\nDTSTAMP:'+stamp(new Date())+'\r\nDTSTART:'+stamp(start)+(end?'\r\nDTEND:'+stamp(end):'')+'\r\nSUMMARY:Hospital appointment\r\nEND:VEVENT\r\nEND:VCALENDAR');}
 saveSlip(){const c=this.confirmation();if(c)this.download('appointment.txt','text/plain',[this.profile()?.hospitalName,c.reference,c.name,new Date(c.startsAt).toLocaleString(),this.profile()?.address,'Booking ID: '+c.id,'Registration will be completed at reception.'].join('\n'));}
 printConfirmation(){const c=this.confirmation();if(!c)return;const w=window.open('','_blank');if(!w){this.error.set('Allow the appointment print preview to open.');return;}const main=document.createElement('main');for(const [tag,text] of [['h1',this.profile()?.hospitalName??'Appointment'],['h2',c.reference],['p',c.name],['p',new Date(c.startsAt).toLocaleString()+' ('+this.zone+')'],['p',this.profile()?.address??''],['p','Booking ID: '+c.id],['p','Bring this confirmation to reception for identity verification and registration.']]){const element=document.createElement(tag);element.textContent=text;main.appendChild(element);}w.document.write('<!doctype html><html><head><title>Appointment confirmation</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;line-height:1.6;color:#0f172a}main{max-width:640px;margin:auto;border:1px solid #cbd5e1;padding:24px;border-radius:12px}</style></head><body>'+main.outerHTML+'</body></html>');w.document.close();w.focus();w.print();}
 private credentials(){return {challengeId:this.challengeId(),verificationToken:this.token,contactTicket:this.contactTicket};}
 private call<T>(action:string,body:unknown){return this.api.post<T>('/public-booking/'+this.link+'/'+action,body);}
 private async run(work:()=>Promise<unknown>){if(this.busy())return;this.busy.set(true);this.error.set('');try{await work();}catch(e){this.error.set(this.message(e));}finally{this.busy.set(false);}}
 private message(e:unknown){return e instanceof Error?e.message:'Unable to complete booking. Please contact reception.';}
 private localDay(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);}
 private download(name:string,type:string,text:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

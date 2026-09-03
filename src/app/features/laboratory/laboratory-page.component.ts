import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/auth/auth.store';
import { getApiErrorMessage } from '../../core/http/api-error-message';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { CollectedSample, CriticalResult, LabDashboard, LabOrder, LabReport, LabResultDetail, LabTest, LabWorkItem, OrderOptions, PendingCollection, VerificationItem } from './laboratory.models';
import { LaboratoryService } from './laboratory.service';

type LabTab = 'dashboard'|'catalog'|'orders'|'collection'|'worklist'|'verification'|'reports'|'critical';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcGridLoaderComponent],
  selector: 'ac-laboratory-page',
  template: `
    <main class="laboratory-page">
      <header class="page-head">
        <div><p class="ac-eyebrow">Clinical diagnostics</p><h1 class="ac-page-title">Laboratory</h1><p>Order, collect, process, verify, and release diagnostic results from one controlled workspace.</p></div>
        <div class="head-actions">
          <button class="ac-btn ac-btn-secondary" type="button" (click)="refresh()" [disabled]="loading()"><span class="material-symbols-rounded">refresh</span><span>Refresh</span></button>
          <button class="ac-btn ac-btn-primary" type="button" (click)="openOrderDialog()"><span class="material-symbols-rounded">add</span><span>New Lab Order</span></button>
        </div>
      </header>
      <nav class="laboratory-tabs" aria-label="Laboratory workspace">
        @for(tab of tabs; track tab.key){<button type="button" [class.active]="activeTab()===tab.key" (click)="activeTab.set(tab.key)"><span class="material-symbols-rounded">{{tab.icon}}</span>{{tab.label}}@if(tab.count()){<b>{{tab.count()}}</b>}</button>}
      </nav>

      @if(loading()){<section class="panel"><ac-grid-loader title="Loading laboratory workspace..." message="Reconciling orders, specimens, processing, verification, and reports." [compact]="true" /></section>}
      @else {
        @switch(activeTab()){
          @case('dashboard'){
            <section class="metric-grid">
              @for(card of dashboardCards(); track card.label){<button type="button" class="metric" (click)="activeTab.set(card.tab)"><span class="material-symbols-rounded">{{card.icon}}</span><div><small>{{card.label}}</small><strong>{{card.value}}</strong><em>{{card.meta}}</em></div></button>}
            </section>
            <section class="panel"><div class="panel-head"><div><p class="ac-eyebrow">Priority watch</p><h2>Actionable laboratory queues</h2></div><span>Items requiring immediate attention</span></div><div class="queue-grid"><article class="alert critical"><span class="material-symbols-rounded">emergency</span><div><strong>{{dashboard()?.criticalUnacknowledged||0}} critical results</strong><small>Awaiting clinical acknowledgement</small></div><button class="small-btn" (click)="activeTab.set('critical')">Open</button></article><article class="alert stat"><span class="material-symbols-rounded">bolt</span><div><strong>{{dashboard()?.statOpen||0}} STAT orders</strong><small>Open high-priority diagnostics</small></div><button class="small-btn" (click)="activeTab.set('orders')">Open</button></article></div></section>
          }
          @case('catalog'){
            <section class="toolbar panel"><label class="search-field"><span class="material-symbols-rounded">search</span><input type="search" [(ngModel)]="search" placeholder="Search code, name, or category..." /></label><span class="toolbar-summary"><strong>{{filteredTests().length}}</strong> configured tests</span></section>
            <section class="panel"><div class="panel-head"><div><p class="ac-eyebrow">Master data</p><h2>Laboratory test catalog</h2></div><span>Clinical configuration with Billing-owned prices</span></div>
              <div class="cards">@for(test of filteredTests();track test.id){<button class="test-card" type="button" (click)="viewTest(test)"><span class="test-code">{{test.code}}</span><h3>{{test.name}}</h3><p>{{test.category}} · {{test.sampleType||'-'}} / {{test.container||'-'}}</p><div><span>{{duration(test.tatMinutes)}} TAT</span><span>{{money(test.price)}}</span><span>{{test.parameterCount}} parameters</span></div></button>}@empty{<div class="empty">No tests match the search.</div>}</div>
            </section>
            @if(selectedTest()){<div class="overlay"><section class="detail-drawer"><header><div><p class="ac-eyebrow">{{selectedTest()!.test.code}}</p><h2>{{selectedTest()!.test.name}}</h2><span>{{selectedTest()!.test.category}} · {{selectedTest()!.test.department}}</span></div><button class="icon-btn" type="button" (click)="selectedTest.set(null)"><span class="material-symbols-rounded">close</span></button></header><div class="drawer-summary-grid"><span><small>Sample</small><strong>{{selectedTest()!.test.sampleType||'-'}}</strong></span><span><small>Container</small><strong>{{selectedTest()!.test.container||'-'}}</strong></span><span><small>TAT</small><strong>{{duration(selectedTest()!.test.tatMinutes)}}</strong></span><span><small>Price</small><strong>{{money(selectedTest()!.test.price)}}</strong></span></div><div class="parameter-table"><div class="table-head"><span>Parameter</span><span>Type</span><span>Unit</span><span>Critical limits</span></div>@for(p of selectedTest()!.parameters;track p.id){<div class="table-row"><span><strong>{{p.name}}</strong><small>{{p.code}}</small></span><span>{{p.dataType}}</span><span>{{p.unit||'-'}}</span><span>{{p.criticalLow??'-'}} – {{p.criticalHigh??'-'}}</span></div>}@empty{<div class="empty drawer-empty"><span class="material-symbols-rounded">science</span><strong>No parameters configured</strong><p>This test can still be ordered. Add result parameters in the laboratory test catalog setup.</p></div>}</div></section></div>}
          }
          @case('orders'){
            <section class="panel"><div class="panel-head"><div><p class="ac-eyebrow">All sources</p><h2>Lab orders</h2></div><span>OPD, IPD, Emergency, and manual requests</span></div><div class="table"><div class="table-head order-grid"><span>Order / Patient</span><span>Source</span><span>Priority</span><span>Tests</span><span>Status</span></div>@for(o of visibleOrders();track o.id){<div class="table-row order-grid"><span><strong>{{o.orderNumber}}</strong><small>{{o.patientName}} · {{o.medicalRecordNo}}</small></span><span><span class="source-tag">{{o.sourceModule}}</span></span><span><mark [class.stat]="o.priority==='STAT'">{{o.priority}}</mark></span><span>{{o.itemCount}}</span><span><b class="status" [ngClass]="statusClass(o.statusCode)">{{status(o.statusCode)}}</b></span></div>}@empty{<div class="empty">No laboratory orders yet.</div>}</div></section>
          }
          @case('collection'){
            <section class="panel collection-panel"><div class="panel-head"><div><p>Specimen management</p><h2>Pending collection</h2></div><label class="barcode-field"><span class="material-symbols-rounded">qr_code_scanner</span><input [(ngModel)]="barcodeSearch" (keyup.enter)="trackSample()" placeholder="Scan barcode / Sample ID" /><button type="button" class="small-btn" (click)="trackSample()">Track</button></label></div><div class="collection-summary"><span><b>{{pending().length}}</b><small>Awaiting collection</small></span><span><b>{{collectionStats().stat}}</b><small>STAT / urgent</small></span><span><b>{{recentSamples().length}}</b><small>Ready to receive</small></span></div><div class="collection-cards">@for(row of pending();track row.orderId){<article class="collection-card"><div class="specimen-icon"><span class="material-symbols-rounded">vaccines</span></div><div class="collection-main"><div class="work-title"><strong>{{row.orderNumber}}</strong><span class="source-tag">{{row.sourceModule || 'LAB'}}</span><mark [class.stat]="row.priority==='STAT'">{{row.priority}}</mark></div><h3>{{row.patientName}}</h3><p>{{row.medicalRecordNo}} · Ordered {{date(row.orderedAt)}}</p><div class="test-pills">@for(test of testNames(row.tests);track test){<span>{{test}}</span>}</div></div><div class="work-action"><button class="ac-btn ac-btn-primary" (click)="collect(row)"><span class="material-symbols-rounded">add_task</span>Collect sample</button></div></article>}@empty{<div class="empty pretty-empty"><span class="material-symbols-rounded">inventory_2</span><strong>No samples pending collection</strong><small>New lab orders will appear here after registration.</small></div>}</div></section>
            @if(recentSamples().length){<section class="panel received-panel"><div class="panel-head"><div><p>Just collected</p><h2>Receive samples</h2></div><span>Scan or confirm handover to processing</span></div><div class="barcode-cards">@for(s of recentSamples();track s.id){<article class="barcode-card"><span class="material-symbols-rounded">barcode</span><div><strong>{{s.sampleNumber}}</strong><small>{{s.patientName}}</small><p>{{s.tests}}</p></div><button class="ac-btn ac-btn-primary" (click)="receive(s.id)">Receive</button></article>}</div></section>}
          }
          @case('worklist'){
            <section class="panel processing-panel"><div class="panel-head"><div><p>Technical processing</p><h2>Laboratory worklist</h2></div><span>{{worklistStats().ready}} ready · {{worklistStats().running}} in process · {{worklistStats().drafted}} drafted</span></div><div class="processing-summary"><span><b>{{sortedWorklist().length}}</b><small>Open work items</small></span><span><b>{{worklistStats().stat}}</b><small>STAT priority</small></span><span><b>{{worklistStats().assigned}}</b><small>Assigned</small></span></div><div class="work-cards">@for(w of sortedWorklist();track w.processingId){<article class="work-card"><div class="work-icon"><span class="material-symbols-rounded">{{w.statusCode==='PENDING'?'hourglass_empty':w.statusCode==='RESULT_ENTERED'?'edit_note':'science'}}</span></div><div class="work-main"><div class="work-title"><strong>{{w.sampleNumber}}</strong><mark [class.stat]="w.priority==='STAT'">{{w.priority}}</mark><mark class="status" [class.success]="statusClass(w.statusCode)==='success'" [class.warning]="statusClass(w.statusCode)==='warning'" [class.danger]="statusClass(w.statusCode)==='danger'">{{status(w.statusCode)}}</mark></div><h3>{{w.testName}}</h3><p>{{w.patientName}} · {{w.medicalRecordNo}}</p><div class="work-meta"><span><i class="material-symbols-rounded">receipt_long</i>{{w.orderNumber}}</span><span><i class="material-symbols-rounded">domain</i>{{w.department}}</span><span><i class="material-symbols-rounded">person</i>{{w.technicianName || 'Unassigned'}}</span>@if(w.startedAt){<span><i class="material-symbols-rounded">schedule</i>Started {{date(w.startedAt)}}</span>}</div></div><div class="work-action">@if(w.statusCode==='PENDING'){<button class="ac-btn ac-btn-secondary" (click)="start(w)"><span class="material-symbols-rounded">play_arrow</span>Start</button>}@else{<button class="ac-btn ac-btn-primary" (click)="enterResult(w)"><span class="material-symbols-rounded">edit_square</span>Enter result</button>}</div></article>}@empty{<div class="empty pretty-empty"><span class="material-symbols-rounded">task_alt</span><strong>Processing queue is clear</strong><small>Received samples that need technical work will appear here.</small></div>}</div></section>
          }
          @case('verification'){
            <section class="panel verification-panel"><div class="panel-head"><div><p>Authorized review</p><h2>Verification queue</h2></div><span>Open every result before release</span></div><div class="cards">@for(v of verification();track v.resultId){<article class="verify-card review-card"><div><span class="test-code">{{v.sampleNumber}}</span><h3>{{v.patientName}}</h3><p>{{v.testName}} · Technician: {{v.technicianName||'-'}}</p><small>{{v.orderNumber}} · Submitted {{date(v.submittedAt)}}</small></div>@if(v.hasCritical){<mark class="danger">CRITICAL</mark>}<div class="actions"><button class="ac-btn ac-btn-secondary" (click)="reviewResult(v)"><span class="material-symbols-rounded">visibility</span>Review report</button><button (click)="rejectResult(v)">Reject</button><button class="primary" (click)="verify(v)">Verify & release</button></div></article>}@empty{<div class="empty pretty-empty"><span class="material-symbols-rounded">fact_check</span><strong>No results await verification</strong><small>Submitted lab results will appear here for authorized review.</small></div>}</div></section>
          }
          @case('reports'){
            <section class="panel"><div class="panel-head"><div><p>Released diagnostics</p><h2>Laboratory reports</h2></div></div><div class="table"><div class="table-head report-grid"><span>Report</span><span>Patient</span><span>Order</span><span>Released</span><span>Actions</span></div>@for(r of reports();track r.id){<div class="table-row report-grid"><span><strong>{{r.reportNumber}}</strong><small>Version {{r.currentVersion}}</small></span><span>{{r.patientName}}<small>{{r.medicalRecordNo}}</small></span><span>{{r.orderNumber}}</span><span>{{date(r.releasedAt)}}</span><span><button (click)="download(r)"><span class="material-symbols-rounded">picture_as_pdf</span>PDF</button></span></div>}@empty{<div class="empty">No released reports yet.</div>}</div></section>
          }
          @case('critical'){
            <section class="panel"><div class="panel-head"><div><p>Clinical escalation</p><h2>Critical results</h2></div></div><div class="cards">@for(c of critical();track c.id){<article class="critical-card" [class.done]="c.acknowledgedAt"><span class="material-symbols-rounded">warning</span><div><h3>{{c.parameterName}} = {{c.value}} {{c.unit||''}}</h3><p>{{c.patientName}} · {{c.medicalRecordNo}} · {{c.testName}}</p><small>{{c.acknowledgedAt ? 'Acknowledged by '+(c.acknowledgedBy||'clinical user') : 'Clinical acknowledgement required'}}</small></div>@if(!c.acknowledgedAt){<button class="primary" (click)="openAcknowledge(c)">Acknowledge</button>}</article>}@empty{<div class="empty">No critical results.</div>}</div></section>
          }
        }
      }

      @if(orderDialogOpen()){<div class="overlay dialog-overlay"><section class="dialog order-dialog"><header><div><p class="ac-eyebrow">Registration</p><h2>New Lab Order</h2><span>Create one atomic clinical request with Billing-linked tests.</span></div><button class="icon-btn" type="button" (click)="closeOrderDialog()"><span class="material-symbols-rounded">close</span></button></header><form (ngSubmit)="createOrder()" class="form-grid">
        <label class="wide"><span>Patient *</span><select name="patient" [(ngModel)]="orderForm.patientId" required><option value="">Select patient</option>@for(p of options()?.patients||[];track p.id){<option [value]="p.id">{{p.name}} · {{p.medicalRecordNo}}</option>}</select></label>
        <label><span>Doctor</span><select name="doctor" [(ngModel)]="orderForm.doctorId"><option value="">Select doctor</option>@for(d of options()?.doctors||[];track d.id){<option [value]="d.id">{{d.name}}</option>}</select></label><label><span>Source</span><select name="source" [(ngModel)]="orderForm.sourceModule"><option>MANUAL</option><option>OPD</option><option>IPD</option><option>EMERGENCY</option></select></label><label><span>Priority</span><select name="priority" [(ngModel)]="orderForm.priority"><option>ROUTINE</option><option>URGENT</option><option>STAT</option></select></label>
        <label class="wide"><span>Clinical notes</span><textarea name="notes" [(ngModel)]="orderForm.clinicalNotes" rows="3" placeholder="Clinical indication and special instructions"></textarea></label><fieldset class="wide test-picker"><legend>Tests *</legend><div class="checks">@for(t of tests();track t.id){<label><input type="checkbox" [checked]="orderForm.testIds.includes(t.id)" (change)="toggleTest(t.id)" /> <span><strong>{{t.shortName||t.name}}</strong><small>{{t.category}} · {{money(t.price)}}</small></span></label>}</div></fieldset>
        <footer><button class="ac-btn ac-btn-secondary" type="button" (click)="closeOrderDialog()">Cancel</button><button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">Create Order</button></footer>
      </form></section></div>}

      @if(resultEditor()){<div class="overlay dialog-overlay"><section class="dialog result-panel"><header><div><p class="ac-eyebrow">{{resultEditor()!.header.sampleNumber}} · {{resultEditor()!.header.orderNumber}}</p><h2>{{resultEditor()!.header.testName}} result entry</h2><span>{{resultEditor()!.header.patientName}} · {{resultEditor()!.header.medicalRecordNo}}</span></div><button class="icon-btn" type="button" (click)="resultEditor.set(null)"><span class="material-symbols-rounded">close</span></button></header><div class="result-table"><div class="table-head result-grid"><span>Parameter</span><span>Result</span><span>Unit</span><span>Range</span><span>Flag</span></div>@for(p of resultEditor()!.parameters;track p.parameterId){<div class="table-row result-grid"><span><strong>{{p.name}}</strong><small>{{p.code}}</small></span><span>@if(p.dataType==='SELECTION'){<select [(ngModel)]="resultValues[p.parameterId]"><option value="">Select</option>@for(option of selectionOptions(p.selectionOptionsJson);track option){<option>{{option}}</option>}</select>}@else if(p.dataType==='BOOLEAN'){<select [(ngModel)]="resultValues[p.parameterId]"><option value="">Select</option><option value="false">Negative</option><option value="true">Positive</option></select>}@else{<input [(ngModel)]="resultValues[p.parameterId]" [type]="p.dataType==='NUMERIC'?'number':'text'" />}</span><span>{{p.unit||'-'}}</span><span>{{p.referenceRange||'Not configured'}}</span><span><mark [class.danger]="p.isCritical">{{p.flag||'-'}}</mark></span></div>}@empty{<div class="result-empty"><span class="material-symbols-rounded">rule</span><div><strong>No result fields configured</strong><small>This test has no active parameters yet. Reopen after refresh, or add test parameters in the catalog.</small></div></div>}</div><label><span>Technician comment</span><textarea [(ngModel)]="resultComments" rows="2"></textarea></label><footer><button class="ac-btn ac-btn-secondary" type="button" (click)="saveResult(false)">Save Draft</button><button class="ac-btn ac-btn-primary" type="button" (click)="saveResult(true)">Submit for Verification</button></footer></section></div>}
      @if(reviewEditor()){<div class="overlay dialog-overlay"><section class="dialog result-panel review-panel-modal"><header><div><p class="ac-eyebrow">{{reviewEditor()!.header.sampleNumber}} · {{reviewEditor()!.header.orderNumber}}</p><h2>{{reviewEditor()!.header.testName}} report review</h2><span>{{reviewEditor()!.header.patientName}} · {{reviewEditor()!.header.medicalRecordNo}}</span></div><button class="icon-btn" type="button" (click)="reviewEditor.set(null)"><span class="material-symbols-rounded">close</span></button></header><div class="review-banner"><span class="material-symbols-rounded">verified_user</span><div><strong>Review submitted values before release</strong><small>Confirm patient, sample, result values, reference ranges, and critical flags. Verification releases the report when all order items are complete.</small></div></div><div class="result-table review-table"><div class="table-head result-grid"><span>Parameter</span><span>Result</span><span>Unit</span><span>Range</span><span>Flag</span></div>@for(p of reviewEditor()!.parameters;track p.parameterId){<div class="table-row result-grid"><span><strong>{{p.name}}</strong><small>{{p.code}}</small></span><span><b class="result-value">{{resultValue(p)}}</b></span><span>{{p.unit||'-'}}</span><span>{{p.referenceRange||'Not configured'}}</span><span><mark [class.danger]="p.isCritical">{{p.flag||'-'}}</mark></span></div>}@empty{<div class="result-empty"><span class="material-symbols-rounded">warning</span><div><strong>No result values available</strong><small>Reject this result and return it to the technician for correction.</small></div></div>}</div>@if(reviewEditor()!.header.comments){<div class="review-note"><span>Technician comment</span><p>{{reviewEditor()!.header.comments}}</p></div>}<footer><button class="ac-btn ac-btn-secondary" type="button" (click)="rejectReviewedResult()">Reject</button><button class="ac-btn ac-btn-primary" type="button" (click)="verifyReviewedResult()">Verify & release</button></footer></section></div>}
      @if(acknowledgeItem()){<div class="overlay dialog-overlay"><section class="dialog acknowledge-dialog"><header><div><p class="ac-eyebrow">Critical result acknowledgement</p><h2>Enter clinical acknowledgement note</h2><span>{{acknowledgeItem()!.patientName}} · {{acknowledgeItem()!.medicalRecordNo}}</span></div><button class="icon-btn" type="button" (click)="closeAcknowledge()"><span class="material-symbols-rounded">close</span></button></header><div class="ack-critical"><span class="material-symbols-rounded">emergency</span><div><strong>{{acknowledgeItem()!.parameterName}} = {{acknowledgeItem()!.value}} {{acknowledgeItem()!.unit||''}}</strong><small>{{acknowledgeItem()!.testName}} · Clinical acknowledgement required</small></div></div><label><span>Acknowledgement note *</span><textarea [(ngModel)]="acknowledgeNote" rows="4" placeholder="Example: Critical value informed to treating doctor and clinical action initiated."></textarea></label><footer><button class="ac-btn ac-btn-secondary" type="button" (click)="closeAcknowledge()">Cancel</button><button class="ac-btn ac-btn-primary" type="button" (click)="submitAcknowledge()" [disabled]="saving()">Submit acknowledgement</button></footer></section></div>}
    </main>
  `,
  styles: [`
    :host{display:block}.lab-page{padding:24px;background:#f5f7fb;min-height:100vh;color:#17213a}.hero{display:flex;justify-content:space-between;align-items:center;padding:26px 30px;background:linear-gradient(120deg,#173b57,#0d6b72);color:white;border-radius:20px}.hero p,.panel-head p,.drawer p,.result-panel header p{margin:0;text-transform:uppercase;letter-spacing:.13em;font-size:11px;font-weight:800;opacity:.75}.hero h1{margin:4px 0;font-size:31px}.hero span{opacity:.8}.hero button,.table button,.actions button,.critical-card button,.sample-label button,.result-panel button{border:1px solid #d9e0ea;background:white;border-radius:9px;padding:9px 12px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}.tabs{display:flex;gap:6px;overflow:auto;margin:18px 0;background:white;border:1px solid #e0e5ee;border-radius:14px;padding:7px}.tabs button{border:0;background:transparent;padding:10px 13px;border-radius:9px;display:flex;align-items:center;gap:7px;white-space:nowrap;color:#526074;cursor:pointer}.tabs button.active{background:#e5f3f3;color:#075e63;font-weight:800}.tabs b{background:#dbe4ed;padding:2px 6px;border-radius:10px;font-size:10px}.panel{background:white;border:1px solid #e0e5ee;border-radius:17px;padding:19px;margin-bottom:18px;box-shadow:0 8px 24px #20334a0a}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.panel-head h2,.drawer h2,.result-panel h2{margin:3px 0;font-size:20px}.panel-head input{min-width:260px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.kpi{border:1px solid #e0e5ee;background:white;border-radius:16px;padding:18px;text-align:left;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;cursor:pointer}.kpi>span{grid-row:1/4;padding:10px;border-radius:12px;background:#e5f3f3;color:#077078}.kpi strong{font-size:25px}.kpi small{font-weight:800}.kpi em{font-style:normal;color:#748096;font-size:11px}.queue-grid,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.alert,.sample-label{display:flex;align-items:center;gap:12px;border:1px solid #e1e6ed;padding:15px;border-radius:12px}.alert div,.sample-label div{flex:1}.alert small,.sample-label small{display:block;color:#6d798c;margin-top:3px}.alert.critical{background:#fff3f3}.alert.stat{background:#fff8eb}.split{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(560px,1.4fr);gap:18px}.create form{display:grid;gap:13px}label>span,legend{display:block;font-size:12px;font-weight:800;color:#526074;margin-bottom:5px}input,select,textarea{border:1px solid #ccd5e1;border-radius:9px;padding:10px;width:100%;box-sizing:border-box;background:white}.form-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}fieldset{border:1px solid #dfe5ed;border-radius:12px}.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;max-height:190px;overflow:auto}.checks label{display:flex;gap:7px;align-items:center}.checks input{width:auto}.checks small{color:#718096}.primary{background:#0d7377!important;color:white!important;border-color:#0d7377!important;padding:10px 15px!important;border-radius:9px;border:0;cursor:pointer}.compact{padding:7px 9px!important;font-size:12px}.table{overflow:auto}.table-head,.table-row{display:grid;gap:12px;align-items:center;padding:11px 9px;min-width:720px}.table-head{background:#f2f5f8;color:#647084;text-transform:uppercase;font-size:10px;font-weight:900;border-radius:9px}.table-row{border-bottom:1px solid #edf0f4;font-size:13px}.table-row small,.report-grid small{display:block;color:#7b8798;margin-top:3px}.order-grid{grid-template-columns:2.2fr .8fr .7fr .4fr 1.1fr}.collection-grid{grid-template-columns:1.5fr 2fr .6fr .9fr .9fr}.work-grid{grid-template-columns:1.5fr 1.2fr 1fr .6fr .8fr .8fr}.report-grid{grid-template-columns:1fr 1.5fr 1fr 1fr .6fr}.result-grid{grid-template-columns:1.4fr 1.2fr .7fr 1fr .7fr}.status{color:#096a70}.test-card,.verify-card{border:1px solid #e0e5ee;border-radius:13px;padding:15px;background:white;text-align:left}.test-card{cursor:pointer}.test-card h3,.verify-card h3,.critical-card h3{margin:7px 0}.test-card p,.verify-card p,.critical-card p{color:#667386;margin:5px 0}.test-card>div{display:flex;gap:7px;flex-wrap:wrap}.test-card>div span,.test-code{font-size:10px;font-weight:900;background:#eef3f7;padding:5px 7px;border-radius:7px;color:#476173}.verify-card{display:grid;gap:10px}.actions{display:flex;justify-content:flex-end;gap:8px}.critical-card{display:flex;align-items:center;gap:14px;border:1px solid #f0b5b5;background:#fff5f5;border-radius:13px;padding:15px}.critical-card>div{flex:1}.critical-card.done{background:#f1faf5;border-color:#bde4cb}.danger{background:#b42318!important;color:white!important}.stat{background:#e15b17!important;color:white!important}mark{border-radius:7px;padding:4px 7px;background:#edf1f5}.drawer{position:fixed;right:0;top:0;height:100vh;width:min(570px,90vw);background:white;z-index:30;box-shadow:-12px 0 45px #17213a33;padding:24px;box-sizing:border-box;overflow:auto}.drawer header,.result-panel header{display:flex;justify-content:space-between}.drawer header>button,.result-panel header>button{border:0;background:transparent;font-size:28px;cursor:pointer}.parameter-table{margin-top:20px}.parameter-table .table-head,.parameter-table .table-row{grid-template-columns:1.4fr .8fr .8fr 1fr}.modal{position:fixed;inset:0;background:#10182888;z-index:50;display:grid;place-items:center;padding:20px}.result-panel{background:white;border-radius:18px;width:min(1000px,95vw);max-height:92vh;overflow:auto;padding:22px;box-sizing:border-box}.result-panel footer{display:flex;justify-content:flex-end;gap:9px;margin-top:15px}.result-table{margin:18px 0}.empty{padding:40px;text-align:center;color:#798598}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}.split{grid-template-columns:1fr}}@media(max-width:650px){.lab-page{padding:12px}.hero{padding:20px}.kpis{grid-template-columns:1fr}.form-row,.checks{grid-template-columns:1fr}.panel-head{align-items:stretch;flex-direction:column}.panel-head input{min-width:0}}
  `, `
    :host{display:block;width:100%;min-width:0;max-width:100%;overflow-x:hidden}
    .laboratory-page{display:grid;gap:16px;min-width:0;max-width:100%;overflow-x:hidden;padding-bottom:28px;color:#0f172a}
    .laboratory-page *{box-sizing:border-box}
    .page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
    .page-head>div:first-child{min-width:0}
    .page-head h1{margin:2px 0 0;font-size:28px;line-height:1.2;color:#0f172a}
    .page-head p:last-child{margin:6px 0 0;max-width:850px;color:#64748b;font-size:14px;line-height:1.5}
    .head-actions{display:flex;gap:10px;flex:none}
    .laboratory-tabs{display:flex;align-items:center;gap:7px;overflow-x:auto;overflow-y:hidden;background:#fff;border:1px solid #d6e1f2;border-radius:14px;padding:7px 9px 9px;box-shadow:0 4px 14px rgba(16,24,40,.05);scrollbar-width:thin;scrollbar-color:#aeb8c7 #eef3fb}
    .laboratory-tabs::-webkit-scrollbar{height:6px}
    .laboratory-tabs::-webkit-scrollbar-track{background:#eef3fb;border-radius:999px}
    .laboratory-tabs::-webkit-scrollbar-thumb{background:#aeb8c7;border-radius:999px}
    .laboratory-tabs button{height:40px;border:1px solid transparent;border-radius:11px;background:transparent;padding:0 10px;display:flex;align-items:center;gap:8px;white-space:nowrap;color:#5d6b82;cursor:pointer;font:inherit;font-size:13px;font-weight:750;transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease}
    .laboratory-tabs button:hover{background:#f6f9ff;border-color:#e2e9f7;color:#344054}
    .laboratory-tabs button.active{background:#f4f8ff;border-color:#bfdbfe;color:#155eef;box-shadow:0 3px 9px rgba(21,94,239,.11)}
    .laboratory-tabs .material-symbols-rounded{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:9px;background:#edf4ff;color:#526f9f;font-size:18px}
    .laboratory-tabs button.active .material-symbols-rounded{background:#155eef;color:#fff}
    .laboratory-tabs b{min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 5px;border-radius:9px;background:#e8edf5;color:#475467;font-size:10px;font-weight:800;text-align:center}
    .laboratory-tabs button.active b{background:#dbe8ff;color:#155eef}
    .panel,.metric{min-width:0;background:#fff;border:1px solid #dce3ee;box-shadow:0 1px 2px rgba(16,24,40,.05)}
    .panel{padding:16px;margin:0;border-radius:0}
    .panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
    .panel-head p,.ac-eyebrow{margin:0;color:#667085;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:700;opacity:1}
    .panel-head h2,.detail-drawer h2,.dialog h2{margin:3px 0 0;color:#101828;font-size:18px;line-height:1.3}
    .panel-head>span,.dialog header span{color:#667085;font-size:12px}
    .metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px}
    .metric{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:16px;text-align:left;border-top:2px solid #2563eb;cursor:pointer}
    .metric:hover{border-color:#98b9f3;box-shadow:0 3px 9px rgba(16,24,40,.08)}
    .metric>.material-symbols-rounded{grid-row:1/4;width:38px;height:38px;display:grid;place-items:center;background:#eef4ff;color:#155eef}
    .metric>div{display:grid;gap:2px}
    .metric strong{font-size:24px;line-height:1.15;color:#101828}
    .metric small{font-weight:700;color:#344054}
    .metric em{font-style:normal;color:#667085;font-size:11px}
    .queue-grid,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}
    .alert,.sample-label{display:flex;align-items:center;gap:12px;border:1px solid #e4e7ec;padding:14px;border-radius:0}
    .alert>span,.sample-label>span{color:#475467}
    .alert div,.sample-label div{flex:1;min-width:0}
    .alert small,.sample-label small{display:block;margin-top:3px;color:#667085}
    .alert.critical{border-left:3px solid #d92d20;background:#fff8f7}
    .alert.stat{border-left:3px solid #f79009;background:#fffcf5!important;color:#0f172a!important}
    .toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px}
    .search-field{position:relative;display:block;flex:1;max-width:480px}
    .search-field>span{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#667085;font-size:20px}
    .search-field input{padding-left:38px}
    .toolbar-summary{color:#667085;font-size:12px;white-space:nowrap}
    label>span,legend{display:block;margin-bottom:5px;color:#475467;font-size:12px;font-weight:700}
    input,select,textarea{width:100%;min-height:38px;border:1px solid #cfd7e3;border-radius:4px;padding:8px 10px;background:#fff;color:#101828;font:inherit;font-size:13px;outline:none}
    textarea{resize:vertical}
    input:focus,select:focus,textarea:focus{border-color:#84adff;box-shadow:0 0 0 3px rgba(21,94,239,.1)}
    .panel-head input{min-width:260px}
    fieldset{margin:0;border:1px solid #dce3ee;border-radius:4px;padding:12px}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .form-grid .full,.form-grid .wide{grid-column:1/-1}
    .checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:210px;overflow:auto}
    .checks label{display:flex;align-items:center;gap:8px;padding:7px;border:1px solid transparent;font-size:12px}
    .checks label:hover{background:#f7f9fc;border-color:#e4e7ec}
    .checks input{width:16px;min-height:auto;height:16px;flex:none}
    .checks small{margin-left:auto;color:#667085}
    .table{overflow:auto;border:1px solid #e4e7ec}
    .table-head,.table-row{display:grid;gap:12px;align-items:center;min-width:720px;padding:10px 12px}
    .table-head{background:#f7f9fc;border-radius:0;border-bottom:1px solid #e4e7ec;color:#667085;text-transform:uppercase;font-size:10px;font-weight:700;letter-spacing:.04em}
    .table-row{border-bottom:1px solid #eef1f5;font-size:13px}
    .table-row:last-child{border-bottom:0}
    .table-row:hover{background:#fbfcfe}
    .table-row small,.report-grid small{display:block;margin-top:3px;color:#667085}
    .table button,.actions button,.critical-card button,.sample-label button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;border:1px solid #cfd7e3;border-radius:4px;padding:7px 10px;background:#fff;color:#344054;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
    .table button:hover,.actions button:hover{background:#f7f9fc}
    .primary{min-height:36px!important;border:1px solid #155eef!important;border-radius:4px!important;padding:8px 13px!important;background:#155eef!important;color:#fff!important;font-weight:600}
    .primary:hover{background:#0f4bcc!important}
    .compact{min-height:32px!important;padding:6px 9px!important;font-size:12px!important}
    .small-btn{border:1px solid #cfd7e3;border-radius:4px;padding:6px 10px;background:#fff;color:#344054;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
    mark{display:inline-flex;border-radius:10px;padding:3px 7px;background:#f2f4f7;color:#475467;font-size:11px;font-weight:700}
    mark.stat{background:#fff0c2!important;color:#93370d!important}
    mark.danger{background:#fee4e2!important;color:#b42318!important}
    .status{display:inline-flex;border-radius:10px;padding:3px 7px;background:#f2f4f7;color:#475467;font-size:11px;font-weight:700}
    .status.success{background:#dcfae6;color:#067647}.status.warning{background:#fef0c7;color:#93370d}.status.danger{background:#fee4e2;color:#b42318}.status.muted{background:#f2f4f7;color:#475467}
    .source-tag,.test-card>div span,.test-code{display:inline-flex;border-radius:3px;padding:4px 6px;background:#eef4ff;color:#155eef;font-size:10px;font-weight:700}
    .test-card,.verify-card{border:1px solid #dce3ee;border-radius:0;padding:14px;background:#fff;text-align:left}
    .test-card{cursor:pointer}
    .test-card:hover{border-color:#84adff;box-shadow:0 2px 7px rgba(16,24,40,.07)}
    .test-card h3,.verify-card h3,.critical-card h3{margin:7px 0;color:#101828;font-size:15px}
    .test-card p,.verify-card p,.critical-card p{margin:5px 0;color:#667085;font-size:12px}
    .test-card>div{display:flex;gap:6px;flex-wrap:wrap}
    .verify-card{display:grid;gap:10px}
    .actions{display:flex;justify-content:flex-end;gap:8px}
    .critical-card{display:flex;align-items:center;gap:14px;border:1px solid #fda29b;border-left:3px solid #d92d20;border-radius:0;padding:14px;background:#fff8f7}
    .critical-card>div{flex:1;min-width:0}
    .critical-card.done{border-color:#a6f4c5;border-left-color:#12b76a;background:#f6fef9}
    .empty{padding:36px;text-align:center;color:#667085;font-size:13px}
    .overlay{position:fixed;inset:0;z-index:60;overflow:hidden;background:rgba(16,24,40,.55)}
    .detail-drawer{position:absolute;right:0;top:0;width:min(640px,100vw);height:100%;max-width:100%;overflow-y:auto;overflow-x:hidden;padding:22px;background:#fff;box-shadow:-12px 0 32px rgba(16,24,40,.16)}
    .detail-drawer header,.dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:14px;border-bottom:1px solid #e4e7ec}
    .detail-drawer header>div{min-width:0}
    .detail-drawer header h2,.detail-drawer header span{overflow-wrap:anywhere}
    .icon-btn{width:34px;height:34px;display:grid;place-items:center;flex:none;border:1px solid #d5deea;border-radius:50%;background:#fff;color:#64748b;cursor:pointer;box-shadow:0 6px 16px rgba(15,23,42,.06);transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease,box-shadow .18s ease}
    .icon-btn .material-symbols-rounded{font-size:18px;line-height:1}
    .icon-btn:hover{background:#eff6ff;border-color:#93c5fd;color:#155eef;transform:translateY(-1px);box-shadow:0 10px 22px rgba(37,99,235,.14)}
    .drawer-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}
    .drawer-summary-grid span{display:grid;gap:4px;padding:11px 12px;border:1px solid #e1e8f5;border-radius:12px;background:#f8fbff}
    .drawer-summary-grid small{color:#667085;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}
    .drawer-summary-grid strong{min-width:0;color:#101828;font-size:13px;overflow-wrap:anywhere}
    .parameter-table{width:100%;max-width:100%;overflow:hidden;margin-top:18px;border:1px solid #e4e7ec;border-radius:12px}
    .parameter-table .table-head,.parameter-table .table-row{grid-template-columns:minmax(130px,1.4fr) minmax(78px,.75fr) minmax(64px,.6fr) minmax(104px,.9fr);min-width:0;padding-inline:12px}
    .parameter-table .table-row span{min-width:0;overflow-wrap:anywhere}
    .drawer-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:220px;padding:30px 18px}
    .drawer-empty .material-symbols-rounded{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#eef4ff;color:#155eef}
    .drawer-empty strong{color:#101828}
    .drawer-empty p{max-width:360px;margin:0;color:#667085}
    .dialog-overlay{display:grid;place-items:center;padding:20px}
    .dialog{width:min(760px,96vw);max-height:92vh;overflow:auto;padding:20px;background:#fff;box-shadow:0 20px 48px rgba(16,24,40,.2)}
    .order-dialog{width:min(820px,96vw)}
    .dialog .form-grid{margin-top:18px}
    .dialog header button.icon-btn{width:34px;height:34px;border:1px solid #d5deea;border-radius:50%;padding:0;background:#fff;color:#64748b;font-size:14px}
    .dialog header .ac-eyebrow{opacity:1}
    .form-grid>footer{grid-column:1/-1}
    .dialog footer{display:flex;justify-content:flex-end;gap:9px;margin-top:16px;padding-top:14px;border-top:1px solid #e4e7ec}
    .dialog footer .ac-btn-primary{border-color:#155eef;background:#155eef;color:#fff;border-radius:4px}
    .dialog footer .ac-btn-secondary{border-color:#d0d5dd;background:#fff;color:#344054;border-radius:4px}
    .result-panel{width:min(1000px,96vw);border-radius:0}
    .result-table{margin:18px 0}
    .result-empty{display:flex;align-items:center;gap:12px;margin-top:10px;padding:18px;border:1px dashed #b9c6d8;border-radius:12px;background:#f8fbff;color:#475467}
    .result-empty .material-symbols-rounded{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#eef4ff;color:#155eef}
    .result-empty strong{display:block;color:#101828}
    .result-empty small{display:block;margin-top:3px;color:#667085}
    .collection-panel{background:radial-gradient(circle at top left,rgba(13,148,136,.09),transparent 32%),linear-gradient(180deg,#fff,#fbfdff)}
    .barcode-field{display:flex;align-items:center;gap:8px;min-width:min(520px,100%);padding:7px 8px;border:1px solid #cdd9ec;border-radius:13px;background:#fff;box-shadow:0 5px 14px rgba(15,23,42,.04)}
    .barcode-field>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#eef4ff;color:#155eef}
    .barcode-field input{border:0;padding:5px;box-shadow:none;background:transparent}
    .barcode-field input:focus{outline:none;box-shadow:none}
    .collection-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .collection-summary span{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #d7eee9;border-radius:12px;background:#f4fbf9}
    .collection-summary b{font-size:24px;color:#0f766e}
    .collection-summary small{font-size:12px;font-weight:800;color:#667085}
    .collection-cards,.barcode-cards{display:grid;gap:12px}
    .collection-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:15px;border:1px solid #d7eee9;border-radius:16px;background:linear-gradient(135deg,#fff,#f7fffd);box-shadow:0 8px 20px rgba(15,23,42,.05)}
    .collection-card:hover{border-color:#5eead4;box-shadow:0 14px 30px rgba(13,148,136,.1);transform:translateY(-1px)}
    .specimen-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#ccfbf1;color:#0f766e}
    .collection-main{min-width:0}
    .collection-card h3{margin:7px 0 4px;font-size:18px;color:#101828}
    .collection-card p{margin:0;color:#667085}
    .test-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .test-pills span{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border-radius:999px;background:#eef4ff;color:#475467;font-size:12px;font-weight:750}
    .received-panel{background:radial-gradient(circle at top right,rgba(21,94,239,.08),transparent 32%),linear-gradient(180deg,#fff,#fbfdff)}
    .barcode-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #dbe7fb;border-radius:16px;background:repeating-linear-gradient(90deg,rgba(21,94,239,.05) 0 2px,transparent 2px 9px),#fff;box-shadow:0 8px 20px rgba(15,23,42,.05)}
    .barcode-card>.material-symbols-rounded{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:#eef4ff;color:#155eef}
    .barcode-card strong{font-size:17px;color:#101828}
    .barcode-card small,.barcode-card p{display:block;margin:2px 0 0;color:#667085}
    .barcode-card p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .verification-panel{background:radial-gradient(circle at top right,rgba(124,58,237,.08),transparent 34%),linear-gradient(180deg,#fff,#fbfdff)}
    .review-card{position:relative;overflow:hidden;border-color:#dbe7fb;background:linear-gradient(135deg,#fff,#f8fbff)}
    .review-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(180deg,#7c3aed,#2563eb)}
    .review-card small{display:block;margin-top:6px;color:#667085}
    .review-card .actions{gap:8px;flex-wrap:wrap}
    .review-card .actions .ac-btn-secondary{border-color:#c7d7fe;color:#155eef;background:#eef4ff}
    .review-panel-modal{max-width:1050px}
    .review-banner{display:flex;gap:12px;align-items:flex-start;margin-top:16px;padding:14px;border:1px solid #c7d7fe;border-radius:14px;background:#eef4ff;color:#344054}
    .review-banner>.material-symbols-rounded{width:42px;height:42px;display:grid;place-items:center;flex:none;border-radius:12px;background:#155eef;color:#fff}
    .review-banner strong{display:block;color:#101828}
    .review-banner small{display:block;margin-top:3px;color:#667085}
    .review-table .table-row{background:#fff}
    .result-value{display:inline-flex;min-width:72px;justify-content:center;padding:7px 10px;border-radius:10px;background:#f1f5f9;color:#0f172a}
    .review-note{margin-top:12px;padding:13px 14px;border:1px solid #e4e7ec;border-radius:12px;background:#fbfdff}
    .review-note span{display:block;font-size:12px;font-weight:850;color:#526074}
    .review-note p{margin:5px 0 0;color:#344054}
    .acknowledge-dialog{width:min(620px,95vw)}
    .ack-critical{display:flex;gap:12px;align-items:flex-start;margin:16px 0;padding:14px;border:1px solid #fda29b;border-left:4px solid #d92d20;border-radius:14px;background:#fff7f7}
    .ack-critical>.material-symbols-rounded{width:42px;height:42px;display:grid;place-items:center;flex:none;border-radius:12px;background:#fee4e2;color:#b42318}
    .ack-critical strong{display:block;color:#101828;font-size:16px}
    .ack-critical small{display:block;margin-top:4px;color:#667085}
    .acknowledge-dialog label{display:block;margin-top:12px}
    .acknowledge-dialog textarea{min-height:110px;resize:vertical}
    .processing-panel{background:radial-gradient(circle at top right,rgba(21,94,239,.08),transparent 34%),linear-gradient(180deg,#fff,#fbfdff)}
    .processing-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .processing-summary span{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #dbe7fb;border-radius:12px;background:#f8fbff}
    .processing-summary b{font-size:24px;color:#155eef}
    .processing-summary small{font-size:12px;font-weight:800;color:#667085}
    .work-cards{display:grid;gap:12px}
    .work-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:15px;border:1px solid #dbe7fb;border-radius:16px;background:linear-gradient(135deg,#fff,#f8fbff);box-shadow:0 8px 20px rgba(15,23,42,.05)}
    .work-card:hover{border-color:#9cc3ff;box-shadow:0 14px 30px rgba(21,94,239,.1);transform:translateY(-1px)}
    .work-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#eef4ff;color:#155eef}
    .work-main{min-width:0}
    .work-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .work-title strong{font-size:15px;color:#0f172a}
    .work-card h3{margin:7px 0 4px;font-size:18px;color:#101828}
    .work-card p{margin:0;color:#667085}
    .work-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .work-meta span{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:#eef4ff;color:#475467;font-size:12px;font-weight:750}
    .work-meta i{font-size:15px}
    .work-action{display:flex;justify-content:flex-end}
    .work-action .ac-btn{border-radius:10px;white-space:nowrap}
    .pretty-empty{display:flex;flex-direction:column;align-items:center;gap:5px;border:1px dashed #b9c6d8;border-radius:14px;background:#f8fbff}
    .pretty-empty .material-symbols-rounded{font-size:34px;color:#155eef}
    .pretty-empty strong{color:#101828}
    .pretty-empty small{color:#667085}
    .panel,.metric,.laboratory-tabs,.test-card,.verify-card,.dialog,.detail-drawer{border-radius:14px}
    .panel{padding:18px;border-color:#e1e8f5;background:linear-gradient(180deg,#fff,#fbfdff);box-shadow:0 8px 24px rgba(15,23,42,.05)}
    .panel-head{padding-bottom:10px;border-bottom:1px solid #eef2f7}
    .panel-head h2{font-size:19px;font-weight:850}
    .metric-grid{gap:10px}
    .metric{position:relative;overflow:hidden;min-height:82px;border:1px solid #e1e8f5;border-radius:14px;border-top:0;padding:12px 14px;background:linear-gradient(135deg,#fff 0%,#f8fbff 100%);box-shadow:0 8px 20px rgba(15,23,42,.05)}
    .metric::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(180deg,#2563eb,#60a5fa)}
    .metric:hover{transform:translateY(-1px);border-color:#bfdbfe;box-shadow:0 12px 28px rgba(37,99,235,.12)}
    .metric>.material-symbols-rounded{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#eaf2ff,#f4f8ff);box-shadow:inset 0 0 0 1px #dbeafe;color:#155eef;font-size:19px}
    .metric strong{font-size:22px;font-weight:850}
    .metric small{font-size:12px}
    .metric em{font-size:11.5px}
    .queue-grid{gap:14px}
    .alert,.sample-label,.critical-card{border-radius:13px;background:linear-gradient(135deg,#fff,#fbfdff);box-shadow:0 6px 18px rgba(15,23,42,.04)}
    .alert{min-height:72px}
    .alert>span,.sample-label>span,.critical-card>.material-symbols-rounded{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f1f5ff;color:#2563eb;font-size:20px}
    .alert.critical{background:linear-gradient(135deg,#fff7f7,#fff);border-color:#fee4e2;border-left-width:4px}
    .alert.critical>span{background:#fee4e2;color:#d92d20}
    .alert.stat{background:linear-gradient(135deg,#fffbeb,#fff)!important;border-color:#fedf89;border-left-width:4px}
    .alert.stat>span{background:#fef0c7;color:#f79009}
    .small-btn,.table button,.actions button,.sample-label button,.critical-card button{border-radius:9px}
    .toolbar{border-radius:14px;background:linear-gradient(135deg,#fff,#f8fbff)}
    .search-field input{height:40px;border-radius:10px;background:#f8fafc}
    input,select,textarea{border-radius:10px;background:#fbfdff}
    fieldset{border-radius:12px;background:#fbfdff}
    .checks label{border-radius:10px}
    .checks label:has(input:checked){background:#eef4ff;border-color:#bfdbfe}
    .table{border-radius:12px;background:#fff;border-color:#e1e8f5}
    .table-head{background:#f3f7fc;border-radius:12px 12px 0 0}
    .table-row{padding-block:12px}
    .table-row:hover{background:#f8fbff}
    .source-tag,.test-code,.test-card>div span{border-radius:999px}
    .test-card,.verify-card{background:linear-gradient(135deg,#fff,#f9fbff);box-shadow:0 8px 20px rgba(15,23,42,.04)}
    .test-card h3,.verify-card h3{font-size:15.5px;font-weight:850}
    .verify-card{min-height:142px}
    .verify-card .actions{align-self:end}
    .critical-card{background:linear-gradient(135deg,#fff7f7,#fff)}
    .dialog,.detail-drawer{background:linear-gradient(180deg,#fff,#fbfdff);border:1px solid #e1e8f5}
    .dialog header,.detail-drawer header{margin:-2px -2px 0;padding:2px 2px 14px}
    .dialog .form-grid{padding:2px}
    .result-panel label{display:block;margin-top:12px}
    :host-context(.dark) .laboratory-page{color:#e5e7eb}
    :host-context(.dark) .page-head h1{color:#f8fafc}
    :host-context(.dark) .page-head p:last-child,
    :host-context(.dark) .panel-head>span,
    :host-context(.dark) .dialog header span,
    :host-context(.dark) .toolbar-summary,
    :host-context(.dark) .table-row small,
    :host-context(.dark) .report-grid small,
    :host-context(.dark) .test-card p,
    :host-context(.dark) .verify-card p,
    :host-context(.dark) .critical-card p,
    :host-context(.dark) .alert small,
    :host-context(.dark) .sample-label small,
    :host-context(.dark) .empty{color:#94a3b8}
    :host-context(.dark) .panel,
    :host-context(.dark) .metric,
    :host-context(.dark) .laboratory-tabs,
    :host-context(.dark) .test-card,
    :host-context(.dark) .verify-card,
    :host-context(.dark) .detail-drawer,
    :host-context(.dark) .dialog{background:#111827;border-color:#263244;box-shadow:0 12px 30px rgba(0,0,0,.24)}
    :host-context(.dark) .laboratory-tabs{scrollbar-color:#475569 #1f2937}
    :host-context(.dark) .laboratory-tabs::-webkit-scrollbar-track{background:#1f2937}
    :host-context(.dark) .laboratory-tabs::-webkit-scrollbar-thumb{background:#475569}
    :host-context(.dark) .laboratory-tabs button{color:#cbd5e1}
    :host-context(.dark) .laboratory-tabs button:hover{background:#172033;border-color:#334155;color:#f8fafc}
    :host-context(.dark) .laboratory-tabs button.active{background:#172554;border-color:#2563eb;color:#93c5fd;box-shadow:0 8px 20px rgba(37,99,235,.2)}
    :host-context(.dark) .laboratory-tabs .material-symbols-rounded,
    :host-context(.dark) .metric>.material-symbols-rounded{background:#1e293b;color:#93c5fd}
    :host-context(.dark) .laboratory-tabs button.active .material-symbols-rounded{background:#2563eb;color:#fff}
    :host-context(.dark) .laboratory-tabs b{background:#263244;color:#cbd5e1}
    :host-context(.dark) .laboratory-tabs button.active b{background:#1d4ed8;color:#fff}
    :host-context(.dark) .metric{border-top-color:#3b82f6}
    :host-context(.dark) .metric:hover,
    :host-context(.dark) .test-card:hover{border-color:#3b82f6;box-shadow:0 8px 22px rgba(37,99,235,.16)}
    :host-context(.dark) .metric strong,
    :host-context(.dark) .panel-head h2,
    :host-context(.dark) .detail-drawer h2,
    :host-context(.dark) .dialog h2,
    :host-context(.dark) .test-card h3,
    :host-context(.dark) .verify-card h3,
    :host-context(.dark) .critical-card h3,
    :host-context(.dark) .alert strong,
    :host-context(.dark) .sample-label strong,
    :host-context(.dark) .table-row strong{color:#f8fafc}
    :host-context(.dark) .metric small,
    :host-context(.dark) label>span,
    :host-context(.dark) legend{color:#d1d5db}
    :host-context(.dark) .metric em,
    :host-context(.dark) .panel-head p,
    :host-context(.dark) .ac-eyebrow{color:#8ab4f8}
    :host-context(.dark) input,
    :host-context(.dark) select,
    :host-context(.dark) textarea{background:#0f172a;border-color:#334155;color:#e5e7eb}
    :host-context(.dark) input:focus,
    :host-context(.dark) select:focus,
    :host-context(.dark) textarea:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.15)}
    :host-context(.dark) fieldset,
    :host-context(.dark) .table,
    :host-context(.dark) .parameter-table,
    :host-context(.dark) .detail-drawer header,
    :host-context(.dark) .dialog header,
    :host-context(.dark) .dialog footer{border-color:#263244}
    :host-context(.dark) .table-head{background:#1f2937;border-color:#263244;color:#aeb9c8}
    :host-context(.dark) .table-row{border-color:#1f2937;color:#e5e7eb}
    :host-context(.dark) .table-row:hover,
    :host-context(.dark) .checks label:hover{background:#172033;border-color:#263244}
    :host-context(.dark) .table button,
    :host-context(.dark) .actions button,
    :host-context(.dark) .critical-card button,
    :host-context(.dark) .sample-label button,
    :host-context(.dark) .small-btn,
    :host-context(.dark) .icon-btn,
    :host-context(.dark) .dialog header button.icon-btn,
    :host-context(.dark) .dialog footer .ac-btn-secondary{background:#111827;border-color:#334155;color:#e5e7eb}
    :host-context(.dark) .table button:hover,
    :host-context(.dark) .actions button:hover,
    :host-context(.dark) .small-btn:hover{background:#1f2937}
    :host-context(.dark) .icon-btn:hover,
    :host-context(.dark) .dialog header button.icon-btn:hover{background:#172554;border-color:#3b82f6;color:#bfdbfe;box-shadow:0 10px 22px rgba(37,99,235,.2)}
    :host-context(.dark) .dialog footer .ac-btn-primary,
    :host-context(.dark) .primary{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important}
    :host-context(.dark) .source-tag,
    :host-context(.dark) .test-card>div span,
    :host-context(.dark) .test-code{background:#172554;color:#93c5fd}
    :host-context(.dark) mark{background:#263244;color:#cbd5e1}
    :host-context(.dark) mark.stat{background:#78350f!important;color:#fde68a!important}
    :host-context(.dark) mark.danger{background:#7f1d1d!important;color:#fecaca!important}
    :host-context(.dark) .status{background:#263244;color:#cbd5e1}
    :host-context(.dark) .status.success{background:#064e3b;color:#a7f3d0}
    :host-context(.dark) .status.warning{background:#78350f;color:#fde68a}
    :host-context(.dark) .status.danger{background:#7f1d1d;color:#fecaca}
    :host-context(.dark) .status.muted{background:#263244;color:#cbd5e1}
    :host-context(.dark) .alert{background:#111827;border-color:#263244}
    :host-context(.dark) .alert.critical,
    :host-context(.dark) .critical-card{background:#2a1214;border-color:#7f1d1d;border-left-color:#ef4444}
    :host-context(.dark) .alert.stat{background:#241a0b!important;border-color:#854d0e;color:#f8fafc!important;border-left-color:#f59e0b}
    :host-context(.dark) .critical-card.done{background:#092016;border-color:#166534;border-left-color:#22c55e}
    :host-context(.dark) .panel,
    :host-context(.dark) .metric,
    :host-context(.dark) .toolbar,
    :host-context(.dark) .test-card,
    :host-context(.dark) .verify-card,
    :host-context(.dark) .dialog,
    :host-context(.dark) .detail-drawer{background:linear-gradient(135deg,#111827,#0f172a);border-color:#263244;box-shadow:0 12px 28px rgba(0,0,0,.26)}
    :host-context(.dark) .panel-head{border-bottom-color:#1f2937}
    :host-context(.dark) .metric::before{background:linear-gradient(180deg,#60a5fa,#2563eb)}
    :host-context(.dark) .metric>.material-symbols-rounded,
    :host-context(.dark) .alert>span,
    :host-context(.dark) .sample-label>span,
    :host-context(.dark) .critical-card>.material-symbols-rounded{background:#172554;box-shadow:inset 0 0 0 1px #1d4ed8;color:#bfdbfe}
    :host-context(.dark) .alert.critical>span{background:#450a0a;color:#fecaca;box-shadow:inset 0 0 0 1px #7f1d1d}
    :host-context(.dark) .alert.stat>span{background:#451a03;color:#fde68a;box-shadow:inset 0 0 0 1px #92400e}
    :host-context(.dark) .search-field input,
    :host-context(.dark) fieldset,
    :host-context(.dark) .drawer-summary-grid span{background:#0b1220;border-color:#263244}
    :host-context(.dark) .drawer-summary-grid small{color:#94a3b8}
    :host-context(.dark) .drawer-summary-grid strong,
    :host-context(.dark) .drawer-empty strong{color:#f8fafc}
    :host-context(.dark) .drawer-empty .material-symbols-rounded{background:#172554;color:#bfdbfe}
    :host-context(.dark) .drawer-empty p{color:#94a3b8}
    :host-context(.dark) .result-empty{background:#0b1220;border-color:#334155;color:#cbd5e1}
    :host-context(.dark) .result-empty .material-symbols-rounded{background:#172554;color:#bfdbfe}
    :host-context(.dark) .result-empty strong{color:#f8fafc}
    :host-context(.dark) .result-empty small{color:#94a3b8}
    :host-context(.dark) .collection-panel,
    :host-context(.dark) .received-panel{background:radial-gradient(circle at top left,rgba(20,184,166,.13),transparent 32%),linear-gradient(135deg,#111827,#0f172a)}
    :host-context(.dark) .barcode-field,
    :host-context(.dark) .collection-summary span,
    :host-context(.dark) .collection-card,
    :host-context(.dark) .barcode-card{background:#0b1220;border-color:#263244;color:#e5e7eb}
    :host-context(.dark) .collection-summary b,
    :host-context(.dark) .specimen-icon{color:#5eead4}
    :host-context(.dark) .barcode-field>span,
    :host-context(.dark) .barcode-card>.material-symbols-rounded,
    :host-context(.dark) .test-pills span{background:#172554;color:#bfdbfe}
    :host-context(.dark) .collection-card:hover{border-color:#14b8a6;box-shadow:0 14px 30px rgba(20,184,166,.14)}
    :host-context(.dark) .specimen-icon{background:#134e4a}
    :host-context(.dark) .collection-summary small,
    :host-context(.dark) .collection-card p,
    :host-context(.dark) .barcode-card small,
    :host-context(.dark) .barcode-card p{color:#94a3b8}
    :host-context(.dark) .collection-card h3,
    :host-context(.dark) .barcode-card strong{color:#f8fafc}
    :host-context(.dark) .verification-panel{background:radial-gradient(circle at top right,rgba(124,58,237,.18),transparent 34%),linear-gradient(135deg,#111827,#0f172a)}
    :host-context(.dark) .review-card,
    :host-context(.dark) .review-banner,
    :host-context(.dark) .review-note,
    :host-context(.dark) .review-table .table-row{background:#0b1220;border-color:#263244}
    :host-context(.dark) .review-card .actions .ac-btn-secondary,
    :host-context(.dark) .result-value{background:#172554;border-color:#2563eb;color:#bfdbfe}
    :host-context(.dark) .review-banner>.material-symbols-rounded{background:#2563eb;color:#fff}
    :host-context(.dark) .review-card small,
    :host-context(.dark) .review-banner small,
    :host-context(.dark) .review-note p{color:#94a3b8}
    :host-context(.dark) .review-banner strong,
    :host-context(.dark) .review-note span{color:#f8fafc}
    :host-context(.dark) .ack-critical{background:#2a1214;border-color:#7f1d1d;border-left-color:#ef4444}
    :host-context(.dark) .ack-critical>.material-symbols-rounded{background:#450a0a;color:#fecaca}
    :host-context(.dark) .ack-critical strong{color:#f8fafc}
    :host-context(.dark) .ack-critical small{color:#94a3b8}
    :host-context(.dark) .processing-panel{background:radial-gradient(circle at top right,rgba(37,99,235,.18),transparent 34%),linear-gradient(135deg,#111827,#0f172a)}
    :host-context(.dark) .processing-summary span,
    :host-context(.dark) .work-card,
    :host-context(.dark) .pretty-empty{background:#0b1220;border-color:#263244}
    :host-context(.dark) .processing-summary b,
    :host-context(.dark) .work-icon,
    :host-context(.dark) .pretty-empty .material-symbols-rounded{color:#93c5fd}
    :host-context(.dark) .processing-summary small,
    :host-context(.dark) .work-card p,
    :host-context(.dark) .pretty-empty small{color:#94a3b8}
    :host-context(.dark) .work-card:hover{border-color:#3b82f6;box-shadow:0 14px 30px rgba(37,99,235,.16)}
    :host-context(.dark) .work-icon,
    :host-context(.dark) .work-meta span{background:#172554;color:#bfdbfe}
    :host-context(.dark) .work-title strong,
    :host-context(.dark) .work-card h3,
    :host-context(.dark) .pretty-empty strong{color:#f8fafc}
    :host-context(.dark) .checks label:has(input:checked){background:#172554;border-color:#2563eb}
    :host-context(.dark) .table{background:#0f172a;border-color:#263244}
    :host-context(.dark) .table-head{background:#172033}
    :host-context(.dark) .table-row:hover{background:#111c31}
    :host-context(.dark) .overlay{background:rgba(2,6,23,.72)}
    @media(max-width:900px){.page-head{flex-direction:column}.head-actions{width:100%;flex-wrap:wrap}.form-grid{grid-template-columns:1fr}.form-grid .full,.form-grid .wide{grid-column:auto}}
    @media(max-width:650px){.laboratory-page{gap:12px}.page-head h1{font-size:24px}.head-actions .ac-btn{flex:1}.metric-grid,.processing-summary,.collection-summary{grid-template-columns:1fr}.toolbar,.panel-head{align-items:stretch;flex-direction:column}.panel-head input,.search-field,.barcode-field{min-width:0;max-width:none}.checks{grid-template-columns:1fr}.panel,.dialog{padding:14px}.dialog-overlay{padding:8px}.work-card,.collection-card,.barcode-card{grid-template-columns:1fr}.work-action{justify-content:stretch}.work-action .ac-btn,.barcode-card .ac-btn{width:100%;justify-content:center}}
  `]
})
export class LaboratoryPageComponent implements OnInit {
  private readonly service=inject(LaboratoryService); private readonly toast=inject(ToastService); protected readonly auth=inject(AuthStore);
  protected readonly orderDialogOpen=signal(false);
  protected readonly loading=signal(true); protected readonly saving=signal(false); protected readonly activeTab=signal<LabTab>('dashboard'); protected readonly dashboard=signal<LabDashboard|null>(null); protected readonly tests=signal<LabTest[]>([]); protected readonly orders=signal<LabOrder[]>([]); protected readonly pending=signal<PendingCollection[]>([]); protected readonly worklist=signal<LabWorkItem[]>([]); protected readonly verification=signal<VerificationItem[]>([]); protected readonly reports=signal<LabReport[]>([]); protected readonly critical=signal<CriticalResult[]>([]); protected readonly options=signal<OrderOptions|null>(null); protected readonly selectedTest=signal<any|null>(null); protected readonly resultEditor=signal<LabResultDetail|null>(null); protected readonly reviewEditor=signal<LabResultDetail|null>(null); protected readonly acknowledgeItem=signal<CriticalResult|null>(null); protected readonly recentSamples=signal<CollectedSample[]>([]);
  protected search=''; protected barcodeSearch=''; protected resultComments=''; protected acknowledgeNote=''; protected resultValues:Record<string,string>={}; protected orderForm={patientId:'',doctorId:'',sourceModule:'MANUAL',priority:'ROUTINE',clinicalNotes:'',testIds:[] as string[]};
  protected readonly tabs=[{key:'dashboard' as LabTab,label:'Dashboard',icon:'dashboard',count:()=>0},{key:'catalog' as LabTab,label:'Test Catalog',icon:'biotech',count:()=>this.tests().length},{key:'orders' as LabTab,label:'Orders',icon:'assignment',count:()=>this.visibleOrders().length},{key:'collection' as LabTab,label:'Sample Collection',icon:'vaccines',count:()=>this.pending().length},{key:'worklist' as LabTab,label:'Processing',icon:'science',count:()=>this.worklist().length},{key:'verification' as LabTab,label:'Verification',icon:'fact_check',count:()=>this.verification().length},{key:'reports' as LabTab,label:'Reports',icon:'description',count:()=>this.reports().length},{key:'critical' as LabTab,label:'Critical',icon:'warning',count:()=>this.critical().filter(x=>!x.acknowledgedAt).length}];
  protected readonly filteredTests=computed(()=>{const q=this.search.trim().toLowerCase();return q?this.tests().filter(t=>`${t.code} ${t.name} ${t.category}`.toLowerCase().includes(q)):this.tests();});
  protected readonly visibleOrders=computed(()=>mergeOrderQueues(this.orders(),this.pending()));
  protected readonly dashboardCards=computed(()=>[{label:"Today's orders",value:this.dashboard()?.todayOrders||0,meta:'Registered today',icon:'assignment',tab:'orders' as LabTab},{label:'Sample pending',value:this.dashboard()?.pendingCollection||0,meta:'Awaiting collection',icon:'vaccines',tab:'collection' as LabTab},{label:'Processing',value:this.dashboard()?.processing||0,meta:'Technical worklist',icon:'science',tab:'worklist' as LabTab},{label:'Verify pending',value:this.dashboard()?.verificationPending||0,meta:'Authorized review',icon:'fact_check',tab:'verification' as LabTab},{label:'Reports today',value:this.dashboard()?.reportsToday||0,meta:'Released today',icon:'description',tab:'reports' as LabTab}]);
  protected readonly collectionStats=computed(()=>{const pending=this.pending();return{stat:pending.filter(x=>['STAT','URGENT'].includes(x.priority)).length};});
  protected readonly worklistStats=computed(()=>{const items=this.worklist();return{ready:items.filter(x=>x.statusCode==='PENDING').length,running:items.filter(x=>x.statusCode==='PROCESSING').length,drafted:items.filter(x=>x.statusCode==='RESULT_ENTERED').length,stat:items.filter(x=>x.priority==='STAT').length,assigned:items.filter(x=>!!x.technicianName||!!x.technicianId).length};});
  protected readonly sortedWorklist=computed(()=>[...this.worklist()].sort((a,b)=>workStatusRank(a.statusCode)-workStatusRank(b.statusCode)||priorityRank(a.priority)-priorityRank(b.priority)||dateRank(b.startedAt)-dateRank(a.startedAt)||a.testName.localeCompare(b.testName)));
  ngOnInit(){void this.refresh();}
  protected openOrderDialog(){this.activeTab.set('orders');this.orderDialogOpen.set(true);}
  protected closeOrderDialog(){this.orderDialogOpen.set(false);}
  protected async refresh(){this.loading.set(true);try{const [d,t,o,p,cs,w,v,r,c,x]=await Promise.all([this.service.dashboard(),this.service.tests(),this.service.orders(),this.service.pendingCollection(),this.service.collectedSamples(),this.service.worklist(),this.service.verification(),this.service.reports(),this.service.critical(),this.service.orderOptions()]);this.dashboard.set(d.data);this.tests.set(t.data||[]);this.orders.set(o.data||[]);this.pending.set(p.data||[]);this.recentSamples.set(cs.data||[]);this.worklist.set(w.data||[]);this.verification.set(v.data||[]);this.reports.set(r.data||[]);this.critical.set(c.data||[]);this.options.set(x.data);}finally{this.loading.set(false);}}
  protected toggleTest(id:string){this.orderForm.testIds=this.orderForm.testIds.includes(id)?this.orderForm.testIds.filter(x=>x!==id):[...this.orderForm.testIds,id];}
  protected async createOrder(){if(!this.orderForm.patientId||!this.orderForm.testIds.length){this.toast.warning('Order details required','Select a patient and at least one test.');return;}this.saving.set(true);try{const response=await this.service.createOrder({patientId:this.orderForm.patientId,encounterId:null,encounterType:this.orderForm.sourceModule,doctorId:this.orderForm.doctorId||null,sourceModule:this.orderForm.sourceModule,priority:this.orderForm.priority,clinicalNotes:this.orderForm.clinicalNotes,testIds:this.orderForm.testIds,packageIds:[],idempotencyKey:crypto.randomUUID()});if(response.success){this.toast.success('Lab order created',response.data?.orderNumber||'Order sent to laboratory.');this.orderForm={patientId:'',doctorId:'',sourceModule:'MANUAL',priority:'ROUTINE',clinicalNotes:'',testIds:[]};this.closeOrderDialog();await this.refresh();}else this.toast.error('Unable to create order',response.message);}finally{this.saving.set(false);}}
  protected async collect(row:PendingCollection){const response=await this.service.collect(row.orderId);if(response.success&&response.data){this.toast.success('Sample collected',`${response.data.sampleNumber} barcode generated.`);await this.refresh();}else this.toast.error('Collection failed',response.message);}
  protected async receive(id:string){const response=await this.service.receive(id);if(response.success){this.recentSamples.update(x=>x.filter(s=>s.id!==id));this.toast.success('Sample received','Added to processing worklist.');await this.refresh();}else this.toast.error('Unable to receive sample',response.message);}
  protected async start(row:LabWorkItem){const response=await this.service.start(row.processingId);if(response.success){this.toast.success('Processing started',row.sampleNumber);await this.refresh();}else this.toast.error('Unable to start processing',response.message);}
  protected async enterResult(row:LabWorkItem){const response=await this.service.result(row.orderItemId);if(response.success&&response.data){this.resultValues={};for(const p of response.data.parameters){const value=p.numericValue??p.textValue??p.selectionValue??p.richValue??(p.booleanValue===null?'':String(p.booleanValue));this.resultValues[p.parameterId]=String(value??'');}this.resultComments=response.data.header.comments||'';this.resultEditor.set(response.data);}else this.toast.error('Unable to open result',response.message);}
  protected async saveResult(submit:boolean){const editor=this.resultEditor();if(!editor)return;if(!editor.parameters.length){this.toast.warning('Result fields missing','This test does not have active result parameters. Please reopen after refresh or add parameters in the catalog.');return;}const values=editor.parameters.map(p=>({parameterId:p.parameterId,value:this.resultValues[p.parameterId]||'',comment:''})).filter(x=>x.value!=='');if(submit&&!values.length){this.toast.warning('Enter result value','Add at least one result value before sending for verification.');return;}const response=await this.service.saveResult(editor.header.id,{comments:this.resultComments,values},submit);if(response.success){this.toast.success(submit?'Submitted for verification':'Draft saved',editor.header.testName);this.resultEditor.set(null);await this.refresh();}else this.toast.error('Unable to save results',response.message);}
  protected async reviewResult(item:VerificationItem){const response=await this.service.reviewResult(item.resultId);if(response.success&&response.data)this.reviewEditor.set(response.data);else this.toast.error('Unable to open review',response.message);}
  protected async verify(item:VerificationItem){const response=await this.service.verifyRelease(item.resultId);if(response.success){this.toast.success('Result verified','Report released when all ordered tests are verified.');await this.refresh();}else this.toast.error('Verification failed',labError(response,'Please check reviewer permissions and result status.'));}
  protected async verifyReviewedResult(){const editor=this.reviewEditor();if(!editor)return;const response=await this.service.verifyRelease(editor.header.id);if(response.success){this.toast.success('Result verified','Report released when all ordered tests are verified.');this.reviewEditor.set(null);await this.refresh();}else this.toast.error('Verification failed',labError(response,'Please check reviewer permissions and result status.'));}
  protected async rejectResult(item:VerificationItem){const reason=window.prompt('Reason for returning this result to the technician:');if(!reason)return;const response=await this.service.rejectResult(item.resultId,reason);if(response.success){this.toast.success('Result returned','Technician can correct and resubmit it.');await this.refresh();}else this.toast.error('Unable to reject result',response.message);}
  protected async rejectReviewedResult(){const editor=this.reviewEditor();if(!editor)return;const reason=window.prompt('Reason for returning this result to the technician:');if(!reason)return;const response=await this.service.rejectResult(editor.header.id,reason);if(response.success){this.toast.success('Result returned','Technician can correct and resubmit it.');this.reviewEditor.set(null);await this.refresh();}else this.toast.error('Unable to reject result',response.message);}
  protected openAcknowledge(item:CriticalResult){this.acknowledgeItem.set(item);this.acknowledgeNote='';}
  protected closeAcknowledge(){this.acknowledgeItem.set(null);this.acknowledgeNote='';}
  protected async submitAcknowledge(){const item=this.acknowledgeItem();const note=this.acknowledgeNote.trim();if(!item)return;if(!note){this.toast.warning('Acknowledgement note required','Please enter the clinical acknowledgement note before submitting.');return;}this.saving.set(true);try{const response=await this.service.acknowledge(item.id,note);if(response.success){this.toast.success('Critical result acknowledged',item.patientName);this.closeAcknowledge();await this.refresh();}else this.toast.error('Acknowledgement failed',response.message);}finally{this.saving.set(false);}}
  protected async viewTest(test:LabTest){const response=await this.service.test(test.id);if(response.success)this.selectedTest.set(response.data);}
  protected async trackSample(){if(!this.barcodeSearch.trim())return;const response=await this.service.sample(this.barcodeSearch.trim());if(response.success)this.toast.success('Sample found','Tracking timeline loaded successfully.');else this.toast.error('Sample not found',response.message);}
  protected async download(report:LabReport){const viewer=window.open('about:blank','_blank');try{const blob=await this.service.reportPdf(report.id);const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));if(viewer)viewer.location.href=url;else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.click();}setTimeout(()=>URL.revokeObjectURL(url),60_000);}catch{viewer?.close();this.toast.error('Unable to open PDF','Your session may have expired or you may not have report download permission.');}}
  protected selectionOptions(json:string|null):string[]{try{return json?JSON.parse(json):[];}catch{return[];}} protected money(value:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value||0);} protected duration(minutes:number){return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)}h ${minutes%60||''}`.trim();} protected date(value:string){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'-';} protected status(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());}
  protected resultValue(p:LabResultDetail['parameters'][number]):string{const value=p.numericValue??p.textValue??p.selectionValue??p.richValue??(p.booleanValue===null||p.booleanValue===undefined?null:p.booleanValue?'Positive':'Negative');return String(value??'-');}
  protected testNames(value:string):string[]{return (value||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,5);}
  protected statusClass(value:string){const state=(value||'').toUpperCase();if(['REPORT_RELEASED','VERIFIED','SAMPLE_RECEIVED','COMPLETED'].includes(state))return 'success';if(['CANCELLED','REJECTED','RECOLLECTION_REQUIRED'].includes(state))return 'danger';if(['STAT','VERIFICATION_PENDING','SAMPLE_PENDING','PROCESSING'].includes(state))return 'warning';return 'muted';}
}

function mergeOrderQueues(orders: LabOrder[], pending: PendingCollection[]): LabOrder[] {
  const merged = new Map<string, LabOrder>();
  for (const order of orders) merged.set(order.id, order);
  for (const row of pending) {
    if (merged.has(row.orderId)) continue;
    merged.set(row.orderId, {
      id: row.orderId,
      orderNumber: row.orderNumber,
      patientId: row.patientId,
      patientName: row.patientName,
      medicalRecordNo: row.medicalRecordNo,
      encounterId: null,
      doctorName: null,
      sourceModule: row.sourceModule || 'LAB',
      priority: row.priority,
      clinicalNotes: null,
      statusCode: row.statusCode || 'ORDERED',
      orderedAt: row.orderedAt,
      itemCount: row.itemCount || row.tests.split(',').filter(Boolean).length || 1
    });
  }
  return Array.from(merged.values()).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(b.orderedAt) - Date.parse(a.orderedAt));
}

function priorityRank(priority: string): number {
  return priority === 'STAT' ? 0 : priority === 'URGENT' ? 1 : 2;
}

function workStatusRank(status: string): number {
  const state = (status || '').toUpperCase();
  if (state === 'PROCESSING') return 0;
  if (state === 'RESULT_ENTERED') return 1;
  if (state === 'PENDING') return 2;
  return 3;
}

function dateRank(value: string | null | undefined): number {
  const ticks = Date.parse(value || '');
  return Number.isFinite(ticks) ? ticks : 0;
}

function labError(response: unknown, fallback: string): string {
  return getApiErrorMessage(response as never, fallback);
}

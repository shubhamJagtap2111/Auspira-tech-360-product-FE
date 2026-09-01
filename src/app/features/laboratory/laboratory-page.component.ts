import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AcGridLoaderComponent } from '../../shared/ui/grid-loader/grid-loader.component';
import { CriticalResult, LabDashboard, LabOrder, LabReport, LabResultDetail, LabTest, LabWorkItem, OrderOptions, PendingCollection, VerificationItem } from './laboratory.models';
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
            @if(selectedTest()){<div class="overlay"><section class="detail-drawer"><header><div><p class="ac-eyebrow">{{selectedTest()!.test.code}}</p><h2>{{selectedTest()!.test.name}}</h2><span>{{selectedTest()!.test.category}} · {{selectedTest()!.test.department}}</span></div><button class="icon-btn" type="button" (click)="selectedTest.set(null)"><span class="material-symbols-rounded">close</span></button></header><div class="parameter-table"><div class="table-head"><span>Parameter</span><span>Type</span><span>Unit</span><span>Critical limits</span></div>@for(p of selectedTest()!.parameters;track p.id){<div class="table-row"><span><strong>{{p.name}}</strong><small>{{p.code}}</small></span><span>{{p.dataType}}</span><span>{{p.unit||'-'}}</span><span>{{p.criticalLow??'-'}} – {{p.criticalHigh??'-'}}</span></div>}</div></section></div>}
          }
          @case('orders'){
            <section class="panel"><div class="panel-head"><div><p class="ac-eyebrow">All sources</p><h2>Lab orders</h2></div><span>OPD, IPD, Emergency, and manual requests</span></div><div class="table"><div class="table-head order-grid"><span>Order / Patient</span><span>Source</span><span>Priority</span><span>Tests</span><span>Status</span></div>@for(o of orders();track o.id){<div class="table-row order-grid"><span><strong>{{o.orderNumber}}</strong><small>{{o.patientName}} · {{o.medicalRecordNo}}</small></span><span><span class="source-tag">{{o.sourceModule}}</span></span><span><mark [class.stat]="o.priority==='STAT'">{{o.priority}}</mark></span><span>{{o.itemCount}}</span><span><b class="status" [ngClass]="statusClass(o.statusCode)">{{status(o.statusCode)}}</b></span></div>}@empty{<div class="empty">No laboratory orders yet.</div>}</div></section>
          }
          @case('collection'){
            <section class="panel"><div class="panel-head"><div><p>Specimen management</p><h2>Pending collection</h2></div><input [(ngModel)]="barcodeSearch" (keyup.enter)="trackSample()" placeholder="Scan barcode / Sample ID" /></div><div class="table"><div class="table-head collection-grid"><span>Order / Patient</span><span>Tests</span><span>Priority</span><span>Ordered</span><span>Action</span></div>@for(row of pending();track row.orderId){<div class="table-row collection-grid"><span><strong>{{row.orderNumber}}</strong><small>{{row.patientName}} · {{row.medicalRecordNo}}</small></span><span>{{row.tests}}</span><span><mark [class.stat]="row.priority==='STAT'">{{row.priority}}</mark></span><span>{{date(row.orderedAt)}}</span><span><button class="primary compact" (click)="collect(row)">Collect sample</button></span></div>}@empty{<div class="empty">No samples pending collection.</div>}</div></section>
            @if(recentSamples().length){<section class="panel"><div class="panel-head"><div><p>Just collected</p><h2>Receive samples</h2></div></div><div class="queue-grid">@for(s of recentSamples();track s.id){<article class="sample-label"><span class="material-symbols-rounded">barcode</span><div><strong>{{s.sampleNumber}}</strong><small>{{s.patientName}} · {{s.tests}}</small></div><button class="primary compact" (click)="receive(s.id)">Receive</button></article>}</div></section>}
          }
          @case('worklist'){
            <section class="panel"><div class="panel-head"><div><p>Technical processing</p><h2>Laboratory worklist</h2></div></div><div class="table"><div class="table-head work-grid"><span>Sample / Patient</span><span>Test</span><span>Department</span><span>Priority</span><span>Status</span><span>Action</span></div>@for(w of worklist();track w.processingId){<div class="table-row work-grid"><span><strong>{{w.sampleNumber}}</strong><small>{{w.patientName}} · {{w.medicalRecordNo}}</small></span><span>{{w.testName}}</span><span>{{w.department}}</span><span><mark [class.stat]="w.priority==='STAT'">{{w.priority}}</mark></span><span>{{status(w.statusCode)}}</span><span>@if(w.statusCode==='PENDING'){<button class="compact" (click)="start(w)">Start</button>}@else{<button class="primary compact" (click)="enterResult(w)">Enter result</button>}</span></div>}@empty{<div class="empty">No received samples in the worklist.</div>}</div></section>
          }
          @case('verification'){
            <section class="panel"><div class="panel-head"><div><p>Authorized review</p><h2>Verification queue</h2></div></div><div class="cards">@for(v of verification();track v.resultId){<article class="verify-card"><div><span class="test-code">{{v.sampleNumber}}</span><h3>{{v.patientName}}</h3><p>{{v.testName}} · Technician: {{v.technicianName||'-'}}</p></div>@if(v.hasCritical){<mark class="danger">CRITICAL</mark>}<div class="actions"><button (click)="rejectResult(v)">Reject</button><button class="primary" (click)="verify(v)">Verify & release</button></div></article>}@empty{<div class="empty">No results await verification.</div>}</div></section>
          }
          @case('reports'){
            <section class="panel"><div class="panel-head"><div><p>Released diagnostics</p><h2>Laboratory reports</h2></div></div><div class="table"><div class="table-head report-grid"><span>Report</span><span>Patient</span><span>Order</span><span>Released</span><span>Actions</span></div>@for(r of reports();track r.id){<div class="table-row report-grid"><span><strong>{{r.reportNumber}}</strong><small>Version {{r.currentVersion}}</small></span><span>{{r.patientName}}<small>{{r.medicalRecordNo}}</small></span><span>{{r.orderNumber}}</span><span>{{date(r.releasedAt)}}</span><span><button (click)="download(r)"><span class="material-symbols-rounded">picture_as_pdf</span>PDF</button></span></div>}@empty{<div class="empty">No released reports yet.</div>}</div></section>
          }
          @case('critical'){
            <section class="panel"><div class="panel-head"><div><p>Clinical escalation</p><h2>Critical results</h2></div></div><div class="cards">@for(c of critical();track c.id){<article class="critical-card" [class.done]="c.acknowledgedAt"><span class="material-symbols-rounded">warning</span><div><h3>{{c.parameterName}} = {{c.value}} {{c.unit||''}}</h3><p>{{c.patientName}} · {{c.medicalRecordNo}} · {{c.testName}}</p><small>{{c.acknowledgedAt ? 'Acknowledged by '+(c.acknowledgedBy||'clinical user') : 'Clinical acknowledgement required'}}</small></div>@if(!c.acknowledgedAt){<button class="primary" (click)="acknowledge(c)">Acknowledge</button>}</article>}@empty{<div class="empty">No critical results.</div>}</div></section>
          }
        }
      }

      @if(orderDialogOpen()){<div class="overlay dialog-overlay"><section class="dialog order-dialog"><header><div><p class="ac-eyebrow">Registration</p><h2>New Lab Order</h2><span>Create one atomic clinical request with Billing-linked tests.</span></div><button class="icon-btn" type="button" (click)="closeOrderDialog()"><span class="material-symbols-rounded">close</span></button></header><form (ngSubmit)="createOrder()" class="form-grid">
        <label class="wide"><span>Patient *</span><select name="patient" [(ngModel)]="orderForm.patientId" required><option value="">Select patient</option>@for(p of options()?.patients||[];track p.id){<option [value]="p.id">{{p.name}} · {{p.medicalRecordNo}}</option>}</select></label>
        <label><span>Doctor</span><select name="doctor" [(ngModel)]="orderForm.doctorId"><option value="">Select doctor</option>@for(d of options()?.doctors||[];track d.id){<option [value]="d.id">{{d.name}}</option>}</select></label><label><span>Source</span><select name="source" [(ngModel)]="orderForm.sourceModule"><option>MANUAL</option><option>OPD</option><option>IPD</option><option>EMERGENCY</option></select></label><label><span>Priority</span><select name="priority" [(ngModel)]="orderForm.priority"><option>ROUTINE</option><option>URGENT</option><option>STAT</option></select></label>
        <label class="wide"><span>Clinical notes</span><textarea name="notes" [(ngModel)]="orderForm.clinicalNotes" rows="3" placeholder="Clinical indication and special instructions"></textarea></label><fieldset class="wide test-picker"><legend>Tests *</legend><div class="checks">@for(t of tests();track t.id){<label><input type="checkbox" [checked]="orderForm.testIds.includes(t.id)" (change)="toggleTest(t.id)" /> <span><strong>{{t.shortName||t.name}}</strong><small>{{t.category}} · {{money(t.price)}}</small></span></label>}</div></fieldset>
        <footer><button class="ac-btn ac-btn-secondary" type="button" (click)="closeOrderDialog()">Cancel</button><button class="ac-btn ac-btn-primary" type="submit" [disabled]="saving()">Create Order</button></footer>
      </form></section></div>}

      @if(resultEditor()){<div class="overlay dialog-overlay"><section class="dialog result-panel"><header><div><p class="ac-eyebrow">{{resultEditor()!.header.sampleNumber}} · {{resultEditor()!.header.orderNumber}}</p><h2>{{resultEditor()!.header.testName}} result entry</h2><span>{{resultEditor()!.header.patientName}} · {{resultEditor()!.header.medicalRecordNo}}</span></div><button class="icon-btn" type="button" (click)="resultEditor.set(null)"><span class="material-symbols-rounded">close</span></button></header><div class="result-table"><div class="table-head result-grid"><span>Parameter</span><span>Result</span><span>Unit</span><span>Range</span><span>Flag</span></div>@for(p of resultEditor()!.parameters;track p.parameterId){<div class="table-row result-grid"><span><strong>{{p.name}}</strong><small>{{p.code}}</small></span><span>@if(p.dataType==='SELECTION'){<select [(ngModel)]="resultValues[p.parameterId]"><option value="">Select</option>@for(option of selectionOptions(p.selectionOptionsJson);track option){<option>{{option}}</option>}</select>}@else if(p.dataType==='BOOLEAN'){<select [(ngModel)]="resultValues[p.parameterId]"><option value="">Select</option><option value="false">Negative</option><option value="true">Positive</option></select>}@else{<input [(ngModel)]="resultValues[p.parameterId]" [type]="p.dataType==='NUMERIC'?'number':'text'" />}</span><span>{{p.unit||'-'}}</span><span>{{p.referenceRange||'Auto'}}</span><span><mark [class.danger]="p.isCritical">{{p.flag||'-'}}</mark></span></div>}</div><label><span>Technician comment</span><textarea [(ngModel)]="resultComments" rows="2"></textarea></label><footer><button class="ac-btn ac-btn-secondary" type="button" (click)="saveResult(false)">Save Draft</button><button class="ac-btn ac-btn-primary" type="button" (click)="saveResult(true)">Submit for Verification</button></footer></section></div>}
    </main>
  `,
  styles: [`
    :host{display:block}.lab-page{padding:24px;background:#f5f7fb;min-height:100vh;color:#17213a}.hero{display:flex;justify-content:space-between;align-items:center;padding:26px 30px;background:linear-gradient(120deg,#173b57,#0d6b72);color:white;border-radius:20px}.hero p,.panel-head p,.drawer p,.result-panel header p{margin:0;text-transform:uppercase;letter-spacing:.13em;font-size:11px;font-weight:800;opacity:.75}.hero h1{margin:4px 0;font-size:31px}.hero span{opacity:.8}.hero button,.table button,.actions button,.critical-card button,.sample-label button,.result-panel button{border:1px solid #d9e0ea;background:white;border-radius:9px;padding:9px 12px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}.tabs{display:flex;gap:6px;overflow:auto;margin:18px 0;background:white;border:1px solid #e0e5ee;border-radius:14px;padding:7px}.tabs button{border:0;background:transparent;padding:10px 13px;border-radius:9px;display:flex;align-items:center;gap:7px;white-space:nowrap;color:#526074;cursor:pointer}.tabs button.active{background:#e5f3f3;color:#075e63;font-weight:800}.tabs b{background:#dbe4ed;padding:2px 6px;border-radius:10px;font-size:10px}.panel{background:white;border:1px solid #e0e5ee;border-radius:17px;padding:19px;margin-bottom:18px;box-shadow:0 8px 24px #20334a0a}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.panel-head h2,.drawer h2,.result-panel h2{margin:3px 0;font-size:20px}.panel-head input{min-width:260px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.kpi{border:1px solid #e0e5ee;background:white;border-radius:16px;padding:18px;text-align:left;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;cursor:pointer}.kpi>span{grid-row:1/4;padding:10px;border-radius:12px;background:#e5f3f3;color:#077078}.kpi strong{font-size:25px}.kpi small{font-weight:800}.kpi em{font-style:normal;color:#748096;font-size:11px}.queue-grid,.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.alert,.sample-label{display:flex;align-items:center;gap:12px;border:1px solid #e1e6ed;padding:15px;border-radius:12px}.alert div,.sample-label div{flex:1}.alert small,.sample-label small{display:block;color:#6d798c;margin-top:3px}.alert.critical{background:#fff3f3}.alert.stat{background:#fff8eb}.split{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(560px,1.4fr);gap:18px}.create form{display:grid;gap:13px}label>span,legend{display:block;font-size:12px;font-weight:800;color:#526074;margin-bottom:5px}input,select,textarea{border:1px solid #ccd5e1;border-radius:9px;padding:10px;width:100%;box-sizing:border-box;background:white}.form-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}fieldset{border:1px solid #dfe5ed;border-radius:12px}.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;max-height:190px;overflow:auto}.checks label{display:flex;gap:7px;align-items:center}.checks input{width:auto}.checks small{color:#718096}.primary{background:#0d7377!important;color:white!important;border-color:#0d7377!important;padding:10px 15px!important;border-radius:9px;border:0;cursor:pointer}.compact{padding:7px 9px!important;font-size:12px}.table{overflow:auto}.table-head,.table-row{display:grid;gap:12px;align-items:center;padding:11px 9px;min-width:720px}.table-head{background:#f2f5f8;color:#647084;text-transform:uppercase;font-size:10px;font-weight:900;border-radius:9px}.table-row{border-bottom:1px solid #edf0f4;font-size:13px}.table-row small,.report-grid small{display:block;color:#7b8798;margin-top:3px}.order-grid{grid-template-columns:2.2fr .8fr .7fr .4fr 1.1fr}.collection-grid{grid-template-columns:1.5fr 2fr .6fr .9fr .9fr}.work-grid{grid-template-columns:1.5fr 1.2fr 1fr .6fr .8fr .8fr}.report-grid{grid-template-columns:1fr 1.5fr 1fr 1fr .6fr}.result-grid{grid-template-columns:1.4fr 1.2fr .7fr 1fr .7fr}.status{color:#096a70}.test-card,.verify-card{border:1px solid #e0e5ee;border-radius:13px;padding:15px;background:white;text-align:left}.test-card{cursor:pointer}.test-card h3,.verify-card h3,.critical-card h3{margin:7px 0}.test-card p,.verify-card p,.critical-card p{color:#667386;margin:5px 0}.test-card>div{display:flex;gap:7px;flex-wrap:wrap}.test-card>div span,.test-code{font-size:10px;font-weight:900;background:#eef3f7;padding:5px 7px;border-radius:7px;color:#476173}.verify-card{display:grid;gap:10px}.actions{display:flex;justify-content:flex-end;gap:8px}.critical-card{display:flex;align-items:center;gap:14px;border:1px solid #f0b5b5;background:#fff5f5;border-radius:13px;padding:15px}.critical-card>div{flex:1}.critical-card.done{background:#f1faf5;border-color:#bde4cb}.danger{background:#b42318!important;color:white!important}.stat{background:#e15b17!important;color:white!important}mark{border-radius:7px;padding:4px 7px;background:#edf1f5}.drawer{position:fixed;right:0;top:0;height:100vh;width:min(570px,90vw);background:white;z-index:30;box-shadow:-12px 0 45px #17213a33;padding:24px;box-sizing:border-box;overflow:auto}.drawer header,.result-panel header{display:flex;justify-content:space-between}.drawer header>button,.result-panel header>button{border:0;background:transparent;font-size:28px;cursor:pointer}.parameter-table{margin-top:20px}.parameter-table .table-head,.parameter-table .table-row{grid-template-columns:1.4fr .8fr .8fr 1fr}.modal{position:fixed;inset:0;background:#10182888;z-index:50;display:grid;place-items:center;padding:20px}.result-panel{background:white;border-radius:18px;width:min(1000px,95vw);max-height:92vh;overflow:auto;padding:22px;box-sizing:border-box}.result-panel footer{display:flex;justify-content:flex-end;gap:9px;margin-top:15px}.result-table{margin:18px 0}.empty{padding:40px;text-align:center;color:#798598}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}.split{grid-template-columns:1fr}}@media(max-width:650px){.lab-page{padding:12px}.hero{padding:20px}.kpis{grid-template-columns:1fr}.form-row,.checks{grid-template-columns:1fr}.panel-head{align-items:stretch;flex-direction:column}.panel-head input{min-width:0}}
  `, `
    :host{display:block;width:100%;min-width:0;max-width:100%}
    .laboratory-page{display:grid;gap:16px;min-width:0;max-width:100%;padding-bottom:28px;color:#0f172a}
    .laboratory-page *{box-sizing:border-box}
    .page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
    .page-head>div:first-child{min-width:0}
    .page-head h1{margin:2px 0 0;font-size:28px;line-height:1.2;color:#0f172a}
    .page-head p:last-child{margin:6px 0 0;max-width:850px;color:#64748b;font-size:14px;line-height:1.5}
    .head-actions{display:flex;gap:10px;flex:none}
    .laboratory-tabs{display:flex;gap:2px;overflow-x:auto;background:#fff;border:1px solid #dce3ee;padding:5px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
    .laboratory-tabs button{height:42px;border:0;background:transparent;padding:0 13px;display:flex;align-items:center;gap:7px;white-space:nowrap;color:#526074;cursor:pointer;font:inherit;font-size:13px}
    .laboratory-tabs button:hover{background:#f7f9fc;color:#344054}
    .laboratory-tabs button.active{background:#eef4ff;color:#155eef;font-weight:700}
    .laboratory-tabs b{min-width:18px;padding:2px 5px;border-radius:10px;background:#e8edf5;color:#475467;font-size:10px;text-align:center}
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
    .alert.stat{border-left:3px solid #f79009;background:#fffcf5}
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
    .form-grid .full{grid-column:1/-1}
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
    .overlay{position:fixed;inset:0;z-index:60;background:rgba(16,24,40,.55)}
    .detail-drawer{position:absolute;right:0;top:0;width:min(580px,94vw);height:100%;overflow:auto;padding:22px;background:#fff;box-shadow:-12px 0 32px rgba(16,24,40,.16)}
    .detail-drawer header,.dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:14px;border-bottom:1px solid #e4e7ec}
    .icon-btn{width:36px;height:36px;display:grid;place-items:center;flex:none;border:1px solid #d0d5dd;border-radius:4px;background:#fff;color:#475467;cursor:pointer}
    .icon-btn:hover{background:#f7f9fc}
    .parameter-table{margin-top:18px}
    .parameter-table .table-head,.parameter-table .table-row{grid-template-columns:1.4fr .8fr .8fr 1fr}
    .dialog-overlay{display:grid;place-items:center;padding:20px}
    .dialog{width:min(760px,96vw);max-height:92vh;overflow:auto;padding:20px;background:#fff;box-shadow:0 20px 48px rgba(16,24,40,.2)}
    .order-dialog{width:min(820px,96vw)}
    .dialog .form-grid{margin-top:18px}
    .dialog footer{display:flex;justify-content:flex-end;gap:9px;margin-top:16px;padding-top:14px;border-top:1px solid #e4e7ec}
    .result-panel{width:min(1000px,96vw);border-radius:0}
    .result-table{margin:18px 0}
    @media(max-width:900px){.page-head{flex-direction:column}.head-actions{width:100%;flex-wrap:wrap}.form-grid{grid-template-columns:1fr}.form-grid .full{grid-column:auto}}
    @media(max-width:650px){.laboratory-page{gap:12px}.page-head h1{font-size:24px}.head-actions .ac-btn{flex:1}.metric-grid{grid-template-columns:1fr}.toolbar,.panel-head{align-items:stretch;flex-direction:column}.panel-head input,.search-field{min-width:0;max-width:none}.checks{grid-template-columns:1fr}.panel,.dialog{padding:14px}.dialog-overlay{padding:8px}}
  `]
})
export class LaboratoryPageComponent implements OnInit {
  private readonly service=inject(LaboratoryService); private readonly toast=inject(ToastService); protected readonly auth=inject(AuthStore);
  protected readonly loading=signal(true); protected readonly saving=signal(false); protected readonly activeTab=signal<LabTab>('dashboard'); protected readonly dashboard=signal<LabDashboard|null>(null); protected readonly tests=signal<LabTest[]>([]); protected readonly orders=signal<LabOrder[]>([]); protected readonly pending=signal<PendingCollection[]>([]); protected readonly worklist=signal<LabWorkItem[]>([]); protected readonly verification=signal<VerificationItem[]>([]); protected readonly reports=signal<LabReport[]>([]); protected readonly critical=signal<CriticalResult[]>([]); protected readonly options=signal<OrderOptions|null>(null); protected readonly selectedTest=signal<any|null>(null); protected readonly resultEditor=signal<LabResultDetail|null>(null); protected readonly recentSamples=signal<Array<{id:string;sampleNumber:string;patientName:string;tests:string}>>([]);
  protected search=''; protected barcodeSearch=''; protected resultComments=''; protected resultValues:Record<string,string>={}; protected orderForm={patientId:'',doctorId:'',sourceModule:'MANUAL',priority:'ROUTINE',clinicalNotes:'',testIds:[] as string[]};
  protected readonly tabs=[{key:'dashboard' as LabTab,label:'Dashboard',icon:'dashboard',count:()=>0},{key:'catalog' as LabTab,label:'Test Catalog',icon:'biotech',count:()=>this.tests().length},{key:'orders' as LabTab,label:'Orders',icon:'assignment',count:()=>this.orders().length},{key:'collection' as LabTab,label:'Sample Collection',icon:'vaccines',count:()=>this.pending().length},{key:'worklist' as LabTab,label:'Processing',icon:'science',count:()=>this.worklist().length},{key:'verification' as LabTab,label:'Verification',icon:'fact_check',count:()=>this.verification().length},{key:'reports' as LabTab,label:'Reports',icon:'description',count:()=>this.reports().length},{key:'critical' as LabTab,label:'Critical',icon:'warning',count:()=>this.critical().filter(x=>!x.acknowledgedAt).length}];
  protected readonly filteredTests=computed(()=>{const q=this.search.trim().toLowerCase();return q?this.tests().filter(t=>`${t.code} ${t.name} ${t.category}`.toLowerCase().includes(q)):this.tests();});
  protected readonly dashboardCards=computed(()=>[{label:"Today's orders",value:this.dashboard()?.todayOrders||0,meta:'Registered today',icon:'assignment',tab:'orders' as LabTab},{label:'Sample pending',value:this.dashboard()?.pendingCollection||0,meta:'Awaiting collection',icon:'vaccines',tab:'collection' as LabTab},{label:'Processing',value:this.dashboard()?.processing||0,meta:'Technical worklist',icon:'science',tab:'worklist' as LabTab},{label:'Verify pending',value:this.dashboard()?.verificationPending||0,meta:'Authorized review',icon:'fact_check',tab:'verification' as LabTab},{label:'Reports today',value:this.dashboard()?.reportsToday||0,meta:'Released today',icon:'description',tab:'reports' as LabTab}]);
  ngOnInit(){void this.refresh();}
  protected async refresh(){this.loading.set(true);try{const [d,t,o,p,w,v,r,c,x]=await Promise.all([this.service.dashboard(),this.service.tests(),this.service.orders(),this.service.pendingCollection(),this.service.worklist(),this.service.verification(),this.service.reports(),this.service.critical(),this.service.orderOptions()]);this.dashboard.set(d.data);this.tests.set(t.data||[]);this.orders.set(o.data||[]);this.pending.set(p.data||[]);this.worklist.set(w.data||[]);this.verification.set(v.data||[]);this.reports.set(r.data||[]);this.critical.set(c.data||[]);this.options.set(x.data);}finally{this.loading.set(false);}}
  protected toggleTest(id:string){this.orderForm.testIds=this.orderForm.testIds.includes(id)?this.orderForm.testIds.filter(x=>x!==id):[...this.orderForm.testIds,id];}
  protected async createOrder(){if(!this.orderForm.patientId||!this.orderForm.testIds.length){this.toast.warning('Order details required','Select a patient and at least one test.');return;}this.saving.set(true);try{const response=await this.service.createOrder({patientId:this.orderForm.patientId,encounterId:null,encounterType:this.orderForm.sourceModule,doctorId:this.orderForm.doctorId||null,sourceModule:this.orderForm.sourceModule,priority:this.orderForm.priority,clinicalNotes:this.orderForm.clinicalNotes,testIds:this.orderForm.testIds,packageIds:[],idempotencyKey:crypto.randomUUID()});if(response.success){this.toast.success('Lab order created',response.data?.orderNumber||'Order sent to laboratory.');this.orderForm={patientId:'',doctorId:'',sourceModule:'MANUAL',priority:'ROUTINE',clinicalNotes:'',testIds:[]};await this.refresh();}else this.toast.error('Unable to create order',response.message);}finally{this.saving.set(false);}}
  protected async collect(row:PendingCollection){const response=await this.service.collect(row.orderId);if(response.success&&response.data){this.recentSamples.update(items=>[{id:response.data!.id,sampleNumber:response.data!.sampleNumber,patientName:row.patientName,tests:row.tests},...items]);this.toast.success('Sample collected',`${response.data.sampleNumber} barcode generated.`);await this.refresh();}else this.toast.error('Collection failed',response.message);}
  protected async receive(id:string){const response=await this.service.receive(id);if(response.success){this.recentSamples.update(x=>x.filter(s=>s.id!==id));this.toast.success('Sample received','Added to processing worklist.');await this.refresh();}else this.toast.error('Unable to receive sample',response.message);}
  protected async start(row:LabWorkItem){const response=await this.service.start(row.processingId);if(response.success){this.toast.success('Processing started',row.sampleNumber);await this.refresh();}else this.toast.error('Unable to start processing',response.message);}
  protected async enterResult(row:LabWorkItem){const response=await this.service.result(row.orderItemId);if(response.success&&response.data){this.resultValues={};for(const p of response.data.parameters){const value=p.numericValue??p.textValue??p.selectionValue??p.richValue??(p.booleanValue===null?'':String(p.booleanValue));this.resultValues[p.parameterId]=String(value??'');}this.resultComments=response.data.header.comments||'';this.resultEditor.set(response.data);}else this.toast.error('Unable to open result',response.message);}
  protected async saveResult(submit:boolean){const editor=this.resultEditor();if(!editor)return;const response=await this.service.saveResult(editor.header.id,{comments:this.resultComments,values:editor.parameters.map(p=>({parameterId:p.parameterId,value:this.resultValues[p.parameterId]||'',comment:''})).filter(x=>x.value!=='')},submit);if(response.success){this.toast.success(submit?'Submitted for verification':'Draft saved',editor.header.testName);this.resultEditor.set(null);await this.refresh();}else this.toast.error('Unable to save results',response.message);}
  protected async verify(item:VerificationItem){const response=await this.service.verifyRelease(item.resultId);if(response.success){this.toast.success('Result verified','Report released when all ordered tests are verified.');await this.refresh();}else this.toast.error('Verification failed',response.message);}
  protected async rejectResult(item:VerificationItem){const reason=window.prompt('Reason for returning this result to the technician:');if(!reason)return;const response=await this.service.rejectResult(item.resultId,reason);if(response.success){this.toast.success('Result returned','Technician can correct and resubmit it.');await this.refresh();}else this.toast.error('Unable to reject result',response.message);}
  protected async acknowledge(item:CriticalResult){const note=window.prompt('Acknowledgement note:')||'Reviewed by authorized clinical user';const response=await this.service.acknowledge(item.id,note);if(response.success){this.toast.success('Critical result acknowledged',item.patientName);await this.refresh();}else this.toast.error('Acknowledgement failed',response.message);}
  protected async viewTest(test:LabTest){const response=await this.service.test(test.id);if(response.success)this.selectedTest.set(response.data);}
  protected async trackSample(){if(!this.barcodeSearch.trim())return;const response=await this.service.sample(this.barcodeSearch.trim());if(response.success)this.toast.success('Sample found','Tracking timeline loaded successfully.');else this.toast.error('Sample not found',response.message);}
  protected download(report:LabReport){window.open(this.service.reportPdfUrl(report.id),'_blank','noopener');}
  protected selectionOptions(json:string|null):string[]{try{return json?JSON.parse(json):[];}catch{return[];}} protected money(value:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value||0);} protected duration(minutes:number){return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)}h ${minutes%60||''}`.trim();} protected date(value:string){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'-';} protected status(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());}
}

import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { ApiClientService } from '../../core/http/api-client.service';
import { AcDropdownComponent, DropdownOption } from '../../shared/ui/dropdown/dropdown.component';
import { workspaceBadgeClass, workspaceStateLabel } from '../../shared/ui/workspace-presentation';
import { StoreField, StoreRow, storeCommand, storeForms } from './stores.models';

import { alliedForms } from './allied.models';

interface Envelope { success: boolean; data: StoreRow; message?: string; errors?: { code: string }[]; }

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent],
  templateUrl: './stores-workspace.component.html',
  styleUrls: ['../../shared/styles/clinical-integration-workspace.css', './stores-workspace.component.css']
})
export class StoresWorkspaceComponent {
  private readonly api = inject(ApiClientService);
  private readonly auth = inject(AuthStore);
  private readonly branch = inject(BranchContextService);
  protected readonly workspace: string = inject(ActivatedRoute).snapshot.data['workspace'] ?? 'stores';
  protected readonly tabs = this.workspace === 'allied' ? ['shortStay', 'medications', 'physiotherapy', 'diet', 'billing', 'resources']
    : this.workspace === 'kitchen' ? ['kitchen'] : ['stock', 'transfers', 'purchasing', 'equipment', 'configuration'];
  protected readonly tab = signal(this.tabs[0]);
  protected readonly title = this.workspace === 'allied' ? 'Allied care' : this.workspace === 'kitchen' ? 'Kitchen worklist' : 'Stores and equipment';
  protected readonly subtitle = this.workspace === 'allied'
    ? 'Coordinate daycare, dialysis, physiotherapy, and inpatient diet services.'
    : this.workspace === 'kitchen' ? 'Prepare and dispatch verified diet tickets to the ward.'
    : 'Track location stock, transfers, and accountable equipment service.';
  protected readonly preview = signal<StoreRow | null>(null);
  protected readonly medicationSafety = signal<StoreRow[] | null>(null);
  protected overrideReasons: Record<string,string> = {};
  private safetyFingerprint = '';
  protected safetyBlocked() { return this.medicationSafety()?.some(rule => rule['behavior'] === 'BLOCK') ?? false; }
  protected readonly priceTotals = ['gross', 'discount', 'tax', 'total', 'patientAmount', 'payerAmount'];
  protected patientSearch = '';
  private appliedSearch = '';
  protected readonly selected = signal('');
  protected readonly data = signal<StoreRow>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly label = workspaceStateLabel;
  protected readonly badge = workspaceBadgeClass;
  protected readonly string = String;
  protected readonly forms = computed(() => (this.workspace === 'stores' ? storeForms : alliedForms).filter(form => form.tab === this.tab() && this.auth.hasPermission(form.permission)));
  protected readonly form = computed(() => this.forms().find(form => form.key === this.selected()) ?? this.forms()[0]);
  protected readonly columns: Record<string, string[]> = {
    followups:['name','kind','owner','due_at','instructions','status','outcome'],
    sessionReplacements:['original_id','replacement_id','reason','created_at'],
    therapyOutcomes:['medical_record_no','name','stage','value','unit','note','created_at'],
    homeMedications:['name','dose','route','frequency','decision','source','reason'],
    medicationReviews:['medical_record_no','kind','revision','summary','created_at'],
    medications:['medical_record_no','name','dose_text','route','units','due_at','ends_at','status','pharmacy_status'],
    medicationEvents:['medical_record_no','name','dose_text','route','outcome','units','actual_at','verification_mode','reason'],
    dietAssessments:['admission_no','referral','assessment','nutrition_plan','created_at'],
    dietAllergies:['medical_record_no','allergy_name','reaction','severity_code'],
    episodes: ['name', 'kind', 'owner', 'revision', 'status', 'created_at'],
    plans: ['name', 'assessment', 'instructions', 'follow_up', 'created_at'],
    sessions: ['name', 'performer', 'starts_at', 'ends_at', 'status', 'outcome', 'follow_up'],
    entries: ['name', 'kind', 'reference', 'note', 'created_at'],
    resources: ['name', 'code', 'kind', 'asset', 'status', 'maintenance_due'],
    chargeSources: ['name', 'service_date', 'status', 'net_amount'],
    dietOrders: ['admission_no', 'destination', 'diet', 'restrictions', 'status', 'created_at'],
    meals: ['ticket', 'destination', 'service_date', 'slot', 'diet', 'restrictions', 'status'],
    stockPolicies: ['lot_number', 'revision', 'controlled', 'enforce_fefo', 'minimum_celsius', 'maximum_celsius', 'reference'],
    temperatures: ['lot_number', 'value_celsius', 'measured_at', 'excursion', 'status', 'reference'],
    custodyRequests: ['lot_number', 'location', 'requester', 'quantity', 'expires_at', 'exception_reason', 'status'],
    reorderAlerts: ['lot_number', 'location', 'quantity', 'reserved', 'minimum', 'target', 'suggested_quantity'],
    transferDiscrepancies: ['lot_number', 'quantity', 'reason', 'status', 'created_at'],
    purchasingPolicies: ['revision','award_limit','required_quotes','invoice_tolerance_percent','exception_limit','reference'],
    receiptInspections: ['purchase_order_no','delivered','accepted','rejected','damaged','status','reference'],
    invoiceExceptions: ['name','reference','quantity','amount','status','reason'],
    supplierCredits: ['reference','quantity','amount','status','reason'],
    payables: ['purchase_order_no','supplier','reference','amount','credit_amount','net_amount','status'],
    assetDetails: ['asset_no','name','manufacturer','model','custodian','warranty_until','location','reference'],
    serviceAgreements: ['name','supplier','reference','starts_on','ends_on','response_hours','status','terms'],
    imagingAssets: ['room','asset','status'],
    affectedBookings: ['booking_id','module','name','starts_at','ends_at','status','asset_status','maintenance_due'],
    generalIssues:['lot_number','quantity','remaining','department_id','created_at'],
    reconciliation:['name','kind','total','allocated','inTransit','unassigned'],
    reconciliationReviews:['reason','actor','created_at'],
    locationPolicies:['name','restricted','manager','reason'],
    deviceReferenceRuns:['name','mapping_version','adapter_version','actor','created_at'],
    deviceOperations:['name','kind','active','last_seen_at','lab_pending','ot_pending','active_associations'],
    positions: ['name', 'location', 'lot_number', 'serial_number', 'expires_on', 'quantity', 'reserved', 'available'],
    transfers: ['lot_number', 'source', 'destination', 'quantity', 'received', 'status', 'created_at'],
    locations: ['code', 'name', 'kind', 'parent'],
    requisitions: ['name', 'quantity', 'status', 'reason', 'created_at'],
    quotes: ['reference', 'vendor', 'rate', 'valid_until', 'status', 'purchase_order_no'],
    invoiceMatches: ['purchase_order_no', 'name', 'reference', 'quantity', 'amount', 'status', 'created_at'],
    supplierReturns: ['purchase_order_no', 'lot_number', 'location', 'quantity', 'reason', 'created_at'],
    counts: ['lot_number', 'location', 'expected', 'observed', 'status', 'created_at'],
    assets: ['asset_no', 'name', 'serial_number', 'location', 'status', 'maintenance_due'],
    deviceLinks: ['asset', 'kind', 'mapping_version', 'interface_reference', 'status', 'qualified', 'evidence', 'last_seen_at'],
    equipmentJobs: ['asset', 'kind', 'reference', 'status', 'next_due', 'created_at'],
    movements: ['lot_number', 'location', 'kind', 'quantity', 'reason', 'created_at']
  };
  protected values: StoreRow = {};
  private generation = 0;
  private pending?: { fingerprint: string; commandId: string };

  constructor() {
    effect(() => {
      this.branch.selectedBranchCode();
      this.generation++;
      this.data.set({});
      this.patientSearch = '';
      this.appliedSearch = '';
      this.busy.set(false);
      this.reset();
      void this.refresh();
    });
  }

  protected rows(key: string): StoreRow[] {
    const value = this.data()[key];
    const records = Array.isArray(value) ? value as StoreRow[] : [];
    if (['shortStay', 'physiotherapy'].includes(this.tab()) && ['episodes', 'plans', 'sessions', 'entries'].includes(key)) {
      return records.filter(row => (row[key === 'entries' ? 'episode_kind' : 'kind'] === 'PHYSIOTHERAPY') === (this.tab() === 'physiotherapy'));
    }
    return records;
  }

  protected tables(): string[] {
    switch (this.tab()) {
      case 'shortStay':
      case 'physiotherapy': return ['episodes', 'plans', 'sessions', 'therapyOutcomes', 'followups', 'entries'];
      case 'medications': return ['homeMedications', 'medicationReviews', 'medications', 'medicationEvents'];
      case 'diet': return ['dietAllergies', 'dietAssessments', 'dietOrders', 'meals'];
      case 'kitchen': return ['meals'];
      case 'billing': return ['chargeSources'];
      case 'resources': return ['resources'];
      case 'stock': return ['positions', 'reorderAlerts', 'generalIssues', 'custodyRequests', 'temperatures', 'counts', 'movements'];
      case 'configuration': return ['locations', 'locationPolicies', 'stockPolicies', 'purchasingPolicies', 'reconciliation', 'reconciliationReviews'];
      case 'purchasing': return ['requisitions', 'quotes', 'receiptInspections', 'invoiceExceptions', 'supplierCredits', 'payables', 'supplierReturns'];
      case 'equipment': return ['assets', 'assetDetails', 'serviceAgreements', 'imagingAssets', 'affectedBookings', 'equipmentJobs', 'deviceLinks', 'deviceReferenceRuns', 'deviceOperations'];
      default: return ['transfers', 'transferDiscrepancies'];
    }
  }

  protected options(input: StoreField): DropdownOption[] {
    if (input.choices) return input.choices.map(value => ({ value, label: this.label(value) }));
    let records = this.rows(input.source ?? '');
    if (input.source === 'receipts') records = records.filter(row => row['item_id'] === this.values['itemId']);
    if (input.source === 'deviceLinks') records = records.filter(row => row['status'] !== 'WITHDRAWN' && (this.form()?.key !== 'deviceReference' || row['kind'] === 'LAB_REFERENCE'));
    if (input.source === 'deviceReferenceRuns') records = records.filter(row => row['link_id'] === this.values['linkId']);
    if (input.source === 'labMappings') records = records.filter(row => row['device_id'] === this.values['labDeviceId']);
    if (input.source === 'otDevices') records = records.filter(row => row['asset_id'] === this.values['assetId']);
    if (input.source === 'openOrderLines') records = records.filter(row => row['purchase_order_id'] === this.values['orderId']);
    if (input.source === 'receiptInspections') records = records.filter(row => row['order_id'] === this.values['orderId'] && row['line_id'] === this.values['lineId'] && row['status'] === 'INSPECTED' && Number(row['accepted']) > 0);
    if (input.source === 'invoiceExceptions') records = records.filter(row => this.form()?.key === 'match' ? row['status'] === 'APPROVED' && row['order_id'] === this.values['orderId'] && row['item_id'] === this.values['itemId'] : row['status'] === 'PENDING_REVIEW');
    if (input.source === 'supplierCredits') records = records.filter(row => row['status'] === 'PENDING_REVIEW');
    if (input.source === 'payables' && this.form()?.key !== 'supplierCredit') records = records.filter(row => row['status'] === 'PENDING_REVIEW');
    if (input.source === 'orderItems') records = records.filter(row => row['purchase_order_id'] === this.values['orderId']);
    const states: Record<string, string> = { requisitions: 'REQUESTED', quotes: 'SUBMITTED', counts: 'PENDING_REVIEW', equipmentJobs: 'ON_HOLD', temperatures: 'PENDING_REVIEW', custodyRequests: 'PENDING_REVIEW', transferDiscrepancies: 'PENDING_REVIEW' };
    const state = states[input.source ?? ''];
    if (state) records = records.filter(row => row['status'] === state);
    const form = this.form();
    const actionKey = form?.key;
    const selectedEpisode = this.rows('episodes').find(row => row['id'] === this.values['episodeId']);
    const selectedSource = this.rows('chargeSources').find(row => row['id'] === this.values['sourceId']);
    if (input.source === 'sessions' && this.tab() === 'medications') records = records.filter(row => row['kind'] !== 'PHYSIOTHERAPY');
    if (input.source === 'medications') records = records.filter(row => row['session_id'] === this.values['sessionId'] && ['ACTIVE','ON_HOLD'].includes(String(row['status'])));
    if (input.source === 'dispensedSupplies') records = records.filter(row => row['medication_id'] === this.values['medicationId']);
    if (input.source === 'medicationWitnesses') records = records.filter(row => row['order_id'] === this.values['medicationId']);
    if (input.source === 'homeMedications') records = records.filter(row => row['episode_id'] === this.values['episodeId']);
    if (input.source === 'surgicalCases') records = records.filter(row => row['patient_id'] === selectedEpisode?.['patient_id']);
    if (input.source === 'followups') records = records.filter(row => row['status'] !== 'RESOLVED');
    if (input.source === 'generalIssues') records = records.filter(row => Number(row['remaining']) > 0);
    if (input.source === 'sessionSupplies') records = records.filter(row => Number(row['remaining']) > 0);
    if (input.source === 'meals' && actionKey === 'mealReplacement') records = records.filter(row => ['CANCELLED','MISSED','REJECTED'].includes(String(row['status'])));
    if (input.source === 'episodes') records = records.filter(row => row['status'] === 'OPEN');
    if (input.source === 'plans') records = records.filter(row => row['episode_id'] === selectedEpisode?.['id'] && row['revision'] === selectedEpisode?.['revision']);
    if (input.source === 'resources') records = records.filter(row => row['kind'] === selectedEpisode?.['kind']);
    if (input.source === 'performers') records = records.filter(row =>
      (row['role'] === 'PHYSIOTHERAPIST') === (selectedEpisode?.['kind'] === 'PHYSIOTHERAPY'));
    if (form?.states && (input.source === 'sessions' || input.source === 'meals')) records = records.filter(row => form.states!.includes(String(row['status'])));
    if (actionKey === 'charge' && input.source === 'sessions') records = records.filter(row => !this.rows('chargeSources').some(source => source['session_id'] === row['id']));
    if (input.source === 'chargeSources') records = records.filter(row => row['status'] === 'READY_TO_PRICE');
    if (input.source === 'contracts') {
      const serviceDate = String(selectedSource?.['service_date'] ?? '');
      records = records.filter(row => serviceDate >= String(row['effective_from']) && serviceDate <= String(row['effective_to']));
    }
    if (input.source === 'coverages') records = records.filter(row =>
      row['contract_id'] === this.values['contractId'] && row['patient_id'] === selectedSource?.['patient_id']);
    if (input.source === 'dietAssessments') records = records.filter(row => row['admission_id'] === this.values['admissionId']);
    if (input.source === 'dietOrders') records = records.filter(row =>
      row['status'] === 'ACTIVE' && (input.key !== 'replacesId' || row['admission_id'] === this.values['admissionId']));
    if (input.source === 'lots') {
      if (['issue', 'count', 'supplierReturn'].includes(actionKey ?? '')) records = records.filter(row => row['item_id']);
      if (actionKey === 'supplierReturn') records = records.filter(row => row['receipt_id']);
    }
    if (input.source === 'locations') {
      const lot = this.rows('lots').find(row => row['id'] === this.values['lotId']);
      const kind = actionKey === 'batch' ? 'PHARMACY'
        : actionKey === 'location' ? this.values['kind']
        : actionKey === 'allocate' || lot?.['item_id'] ? 'GENERAL'
        : lot?.['batch_id'] ? 'PHARMACY' : undefined;
      if (kind) records = records.filter(row => row['kind'] === kind);
      if (input.key === 'destinationId') records = records.filter(row => row['id'] !== this.values['sourceId']);
    }
    if (input.source === 'transfers') {
      const action = String(this.form()?.fixed?.['action']);
      const statuses: Record<string, string[]> = { APPROVE: ['REQUESTED'], DISPATCH: ['APPROVED'], RECEIVE: ['IN_TRANSIT'], CANCEL: ['REQUESTED','APPROVED'], RETURN: ['IN_TRANSIT'] };
      records = records.filter(row => (actionKey === 'discrepancy' ? row['status'] === 'IN_TRANSIT' : statuses[action]?.includes(String(row['status']))));
    }
    return records.map(row => ({ value: String(row['id']), label: input.source === 'transfers'
      ? `${row['lot_number']} · ${row['source']} → ${row['destination']} · ${row['quantity']}`
      : String(row['name'] ?? row['code'] ?? row['id']) }));
  }

  protected can(permission: string): boolean { return this.auth.hasPermission(permission); }

  protected actions(): DropdownOption[] { return this.forms().map(form => ({ value: form.key, label: form.title })); }
  protected chooseTab(tab: string) { this.tab.set(tab); this.selected.set(''); this.reset(); }
  protected chooseAction(key: string) { this.selected.set(key); this.reset(); }
  protected changed(key: string) {
    if (this.preview()) this.preview.set(null);
    this.medicationSafety.set(null);
    this.safetyFingerprint = '';
    this.overrideReasons = {};
    if (key === 'sessionId') {
      delete this.values['medicationId'];
      delete this.values['dispensingItemId'];
      delete this.values['witnessId'];
    }
    if (key === 'medicationId') {
      delete this.values['dispensingItemId'];
      delete this.values['witnessId'];
    }
    if (key === 'assetId') delete this.values['otDeviceId'];
    if (key === 'linkId') delete this.values['referenceRunId'];
    if (key === 'labDeviceId') delete this.values['mappingVersion'];
    if (key === 'admissionId') { delete this.values['replacesId']; delete this.values['assessmentId']; }
    if (key === 'episodeId') {
      delete this.values['planId'];
      delete this.values['resourceId'];
      delete this.values['performerId'];
    }
    if (key === 'sourceId') delete this.values['contractId'];
    if (key === 'sourceId' || key === 'contractId') delete this.values['coverageId'];
    if (key === 'itemId') delete this.values['receiptId'];
    if (key === 'orderId') {
      delete this.values['itemId'];
      delete this.values['lineId'];
      delete this.values['inspectionId'];
      delete this.values['exceptionId'];
    }
    if (key === 'lineId') delete this.values['inspectionId'];
    if (key === 'kind') delete this.values['parentId'];
    if (key === 'lotId') {
      delete this.values['locationId'];
      delete this.values['sourceId'];
      delete this.values['destinationId'];
    }
    if (key === 'sourceId') delete this.values['destinationId'];
  }

  private reset() {
    this.values = {};
    this.pending = undefined;
    this.preview.set(null);
    this.medicationSafety.set(null);
    this.safetyFingerprint = '';
    this.overrideReasons = {};
    this.error.set('');
    this.notice.set('');
  }

  protected async searchPatients() {
    const query = this.patientSearch.trim();
    if (query.length < 2) {
      this.error.set('Enter at least two characters of the patient name or MRN.');
      return;
    }
    this.error.set('');
    this.appliedSearch = query;
    delete this.values['patientId'];
    await this.refresh();
  }

  protected async refresh() {
    if (this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    try { await this.load(generation); }
    catch (error) { if (generation === this.generation) this.error.set(this.message(error)); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }

  private async load(generation: number) {
    const endpoint = this.workspace === 'allied' ? '/allied?patientSearch=' + encodeURIComponent(this.appliedSearch)
      : this.workspace === 'kitchen' ? '/allied/kitchen' : '/stores';
    const result = await firstValueFrom(this.api.get<Envelope>(endpoint));
    if (!result.success) throw new Error(result.errors?.[0]?.code ? this.label(result.errors[0].code) : result.message || 'Unable to load workspace records.');
    if (generation === this.generation) this.data.set(result.data);
  }

  protected async submit() {
    const form = this.form();
    if (!form || this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const command = storeCommand(form, this.values, this.rows(form.versionFrom ?? ''));
      const fingerprint = JSON.stringify(command);
      const body: StoreRow = form.inspectedReceipt
        ? { notes: command.body['notes'], lines: [{ lineId: command.body['lineId'], quantity: command.body['quantity'], inspectionId: command.body['inspectionId'] }] }
        : { ...command.body };
      if (form.key === 'prescribe' || form.key === 'medicationState') {
        body['overrides'] = [];
        if (form.key === 'prescribe') body['duplicateReason'] = body['duplicateReason'] ?? '';
        if (form.key === 'prescribe' || body['status'] === 'ACTIVE') {
          const medication = this.rows('medications').find(row => row['id'] === this.values['medicationId']);
          const medicine = this.values['medicineId'] ?? medication?.['medicine_id'];
          if (this.safetyFingerprint !== fingerprint) {
            const suffix = form.key === 'medicationState' ? '&medicationId=' + encodeURIComponent(String(this.values['medicationId'])) : '';
            const result = await firstValueFrom(this.api.get<Envelope>('/allied/sessions/' + encodeURIComponent(String(this.values['sessionId'])) + '/medication-safety?medicine=' + encodeURIComponent(String(medicine)) + suffix));
            if (generation !== this.generation) return;
            if (!result.success) throw new Error(result.errors?.[0]?.code ? this.label(result.errors[0].code) : result.message || 'Unable to review medication safety.');
            this.medicationSafety.set((result.data['rules'] ?? []) as StoreRow[]);
            this.safetyFingerprint = fingerprint;
            return;
          }
          if (this.safetyBlocked()) throw new Error('This medication is blocked by the current safety rules.');
          body['overrides'] = (this.medicationSafety() ?? []).filter(rule => rule['behavior'] === 'REQUIRE_OVERRIDE').map(rule => {
            const text = this.overrideReasons[String(rule['ruleId'])]?.trim() ?? '';
            if (text.length < 5) throw new Error('Record a specific reason for every required safety override.');
            return { kind: rule['kind'], ruleId: rule['ruleId'], reason: text };
          });
        }
      }
      const submissionFingerprint = JSON.stringify({ path: command.path, body });
      if (this.pending?.fingerprint !== submissionFingerprint)
        this.pending = { fingerprint: submissionFingerprint, commandId: crypto.randomUUID() };
      body[form.inspectedReceipt ? 'requestId' : 'commandId'] = this.pending.commandId;
      const pricingPreview = form.key === 'price' && !this.preview();
      const endpoint = pricingPreview ? '/allied/pricing/preview' : command.path;
      const result = await firstValueFrom(this.api.post<Envelope>(endpoint, body));
      if (generation !== this.generation) return;
      if (!result.success) throw new Error(result.errors?.[0]?.code ? this.label(result.errors[0].code) : result.message || 'The operation could not be saved.');
      if (pricingPreview) {
        this.preview.set(result.data);
        return;
      }
      this.reset();
      this.notice.set('Record saved.');
      await this.load(generation);
    } catch (error) {
      if (generation === this.generation) this.error.set(this.message(error));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  protected display(value: unknown, column: string): string {
    if (value == null || value === '') return '—';
    if (column.endsWith('_at') || column === 'starts_at' || column === 'ends_at') return new Date(String(value)).toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  private message(error: unknown) {
    const response = error as { error?: Envelope };
    const code = response?.error?.errors?.[0]?.code;
    return code ? this.label(code) : response?.error?.message || (error instanceof Error ? error.message : 'The operation could not be completed.');
  }
}

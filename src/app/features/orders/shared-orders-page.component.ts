import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { workspaceStateLabel, workspaceBadgeClass } from '../../shared/ui/workspace-presentation';

interface Response<T> { success: boolean; data: T | null; message: string; }
interface Patient { id: string; name: string; mrn: string; }
interface Catalogue { id: string; code: string; name: string; department: string; active: boolean; }
interface Order { id: string; patientId: string; patient: string; mrn: string; name: string; department: string; status: string; priority: string; version: number; sourceKind: string; sourceId: string; simulationOnly: boolean; branch: string; }
interface Encounter { id: string; status: string; appointmentId: string; }
interface Queue { id: string; status: string; token: string; }
interface History { status: string; reason: string; actor: string; version: number; createdAt: string; }

@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent], templateUrl: './shared-orders-page.component.html', styleUrl: '../../shared/styles/clinical-integration-workspace.css' })
export class SharedOrdersPageComponent {
  private readonly api = inject(ApiClientService);
  protected readonly auth = inject(AuthStore);
  private readonly branch = inject(BranchContextService);
  private readonly route = inject(ActivatedRoute);
  protected readonly orders = signal<Order[]>([]);
  protected readonly patients = signal<Patient[]>([]);
  protected readonly catalogue = signal<Catalogue[]>([]);
  protected readonly encounters = signal<Encounter[]>([]);
  protected readonly queue = signal<Queue[]>([]);
  protected readonly history = signal<History[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal(''); protected readonly notice = signal('');
  protected search = ''; protected patientId = ''; protected consultationId = ''; protected catalogueId = '';
  protected priority = 'ROUTINE'; protected specimen = ''; protected simulationOnly = false;
  protected admissionId = ''; protected emergencyEpisodeId = '';
  protected department = ''; protected status = ''; protected reason = ''; protected page = 1;
  protected catalogueCode = ''; protected catalogueName = ''; protected catalogueDepartment = 'LAB';
  protected readonly label = workspaceStateLabel;
  protected readonly badge = workspaceBadgeClass;
  protected readonly patientOptions = computed(() => this.patients().map(p => ({ value: p.id, label: `${p.name} · ${p.mrn}` })));
  protected readonly encounterOptions = computed(() => [{ value: '', label: 'No OPD encounter' }, ...this.encounters().map(e => ({ value: e.id, label: `${workspaceStateLabel(e.status)} · ${e.id}` }))]);
  protected readonly serviceOptions = computed(() => this.catalogue().filter(c => c.active&&(!this.emergencyEpisodeId||['IMAGING','PROCEDURE'].includes(c.department))).map(c => ({ value: c.id, label: `${workspaceStateLabel(c.department)} · ${c.name}` })));
  protected readonly departmentOptions = ['LAB','IMAGING','PROCEDURE','PHARMACY'].map(value => ({ value, label: workspaceStateLabel(value) }));
  protected readonly filterDepartmentOptions = [{ value: '', label: 'All departments' }, ...this.departmentOptions];
  protected readonly catalogueDepartmentOptions = this.departmentOptions.filter(o => o.value !== 'PHARMACY');
  protected readonly priorityOptions = ['ROUTINE','URGENT','STAT'].map(value => ({ value, label: workspaceStateLabel(value) }));
  protected readonly statusOptions = [{ value: '', label: 'All statuses' }, ...['PLACED','ACKNOWLEDGED','IN_PROGRESS','COMPLETED','CANCELLED'].map(value => ({ value, label: workspaceStateLabel(value) }))];
  protected nextLabel(order: Order): string { return ({ PLACED: 'Acknowledge', ACKNOWLEDGED: 'Start execution', IN_PROGRESS: 'Complete' } as Record<string,string>)[order.status] ?? ''; }
  private generation = 0; private loadGeneration = 0; private patientGeneration = 0; private key = crypto.randomUUID(); private requestSnapshot = '';
  constructor() {
    effect(() => {
      this.branch.selectedBranchCode(); this.generation++; this.patientGeneration++;
      this.patientId = this.generation===1?(this.route.snapshot.queryParamMap.get('patientId')??''):'';this.consultationId=this.generation===1?(this.route.snapshot.queryParamMap.get('consultationId')??''):'';this.emergencyEpisodeId=this.generation===1?(this.route.snapshot.queryParamMap.get('emergencyEpisodeId')??''):'';
      this.admissionId = this.generation===1?(this.route.snapshot.queryParamMap.get('admissionId')??''):'';
      this.orders.set([]); this.history.set([]); this.encounters.set([]); this.queue.set([]); this.page = 1;
      this.catalogue.set([]); this.patients.set([]); this.catalogueId = ''; this.specimen = ''; this.reason = ''; this.simulationOnly = false;
      this.notice.set('');
      this.key = crypto.randomUUID(); this.requestSnapshot = '';
      void this.refresh();
    });
  }
  protected async refresh() {
    const generation = this.generation;
    const load = ++this.loadGeneration;
    this.busy.set(true); this.error.set('');
    try {
      const query = new URLSearchParams({ page: String(this.page) });
      if (this.department) query.set('department', this.department); if (this.status) query.set('status', this.status);
      const [orders, catalogue, patients] = await Promise.all([
        this.get<Order[]>('/orders?' + query), this.get<Catalogue[]>('/orders/catalogue'), this.get<Patient[]>('/orders/patients?search=' + encodeURIComponent(this.search))
      ]);
      if (generation !== this.generation || load !== this.loadGeneration) return;
      this.orders.set(orders); this.catalogue.set(catalogue); this.patients.set(patients);
      if (this.patientId) await this.patientChanged(false);
    } catch (e) { if (generation === this.generation && load === this.loadGeneration) this.error.set(this.message(e)); }
    finally { if (generation === this.generation && load === this.loadGeneration) this.busy.set(false); }
  }
  protected async findPatients() {
    const generation = this.generation; const searchGeneration = ++this.patientGeneration;
    try { const patients = await this.get<Patient[]>('/orders/patients?search=' + encodeURIComponent(this.search)); if (generation === this.generation && searchGeneration === this.patientGeneration) this.patients.set(patients); }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
  }
  protected async patientChanged(clear = true) {
    const id = this.patientId; const generation = this.generation;
    if (clear) this.consultationId = ''; this.encounters.set([]); this.queue.set([]);
    if (!id) return;
    try { const context = await this.get<{ patient: Patient; encounters: Encounter[]; queue: Queue[] }>('/orders/patient/' + encodeURIComponent(id) + '/context'); if (id === this.patientId && generation === this.generation) { this.encounters.set(context.encounters); this.queue.set(context.queue); if (!this.patients().some(p => p.id === id)) this.patients.update(p => [context.patient, ...p]); } }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
  }
  protected async create() {
    const body = { patientId: this.patientId, consultationId: this.admissionId ? null : this.consultationId || null, catalogueId: this.catalogueId, priority: this.priority, specimen: this.specimen, simulationOnly: this.simulationOnly, admissionId: this.admissionId || null,...(this.emergencyEpisodeId?{emergencyEpisodeId:this.emergencyEpisodeId}:{}) };
    const snapshot = JSON.stringify(body);
    if (snapshot !== this.requestSnapshot) { this.key = crypto.randomUUID(); this.requestSnapshot = snapshot; }
    await this.write('/orders', { ...body, idempotencyKey: this.key }, 'Order saved.');
  }
  protected newRequest() { this.key = crypto.randomUUID(); this.requestSnapshot = ''; this.catalogueId = ''; this.specimen = ''; this.notice.set('New request. Choose a service.'); }
  protected async configure() { await this.write('/orders/catalogue', { id: crypto.randomUUID(), code: this.catalogueCode, name: this.catalogueName, department: this.catalogueDepartment }, 'Catalogue service added.'); }
  protected next(order: Order): string | null { return ({ PLACED: 'ACKNOWLEDGED', ACKNOWLEDGED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' } as Record<string,string>)[order.status] ?? null; }
  protected async transition(order: Order, status: string) { await this.write(`/orders/${order.id}/${status === 'CANCELLED' ? 'cancel' : 'transition'}`, { status, version: order.version, reason: this.reason }, 'Order updated.'); }
  protected async showHistory(order: Order) {
    const generation = this.generation;
    try { const history = await this.get<History[]>(`/orders/${order.id}/history`); if (generation === this.generation) this.history.set(history); }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
  }
  private async write(path: string, body: unknown, notice: string) {
    if (this.busy()) return; const generation = this.generation; this.busy.set(true); this.error.set(''); this.notice.set('');
    try { const result = await firstValueFrom(this.api.post<Response<unknown>>(path, body)); if (!result.success) throw new Error(result.message); if (generation === this.generation) { this.notice.set(notice); await this.refresh(); } }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  private async get<T>(path: string): Promise<T> { const result = await firstValueFrom(this.api.get<Response<T>>(path)); if (!result.success || result.data === null) throw new Error(result.message); return result.data; }
  private message(e: unknown) { return e instanceof Error ? e.message : 'Unable to complete the request.'; }
}

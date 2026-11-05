import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchContextService } from '../../core/context/branch-context.service';
import { AcDropdownComponent } from '../../shared/ui/dropdown/dropdown.component';
import { workspaceStateLabel, workspaceBadgeClass } from '../../shared/ui/workspace-presentation';

interface Response<T> { success: boolean; data: T | null; message: string; }
interface Device { id: string; name: string; branch: string; active: boolean; simulationOnly: boolean; adapterVersion: string; lastSeenAt: string | null; }
interface Message { id: string; messageId: string; deviceId: string; status: string; errorCode: string; mappingVersion: string; attempts: number; }
interface Result { id: string; orderId: string; patient: string; mrn: string; observations: unknown; disposition: string; observedAt: string; simulationOnly: boolean; }
interface Delivery { id: string; orderId: string; eventType: string; version: number; status: string; attempts: number; lastError: string; }
interface Reference { hospitalId: string; hospitalCode: string; branch: string; adapterVersion: string; }

@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink, AcDropdownComponent], templateUrl: './integrations-page.component.html', styleUrl: '../../shared/styles/clinical-integration-workspace.css' })
export class IntegrationsPageComponent {
  private readonly api = inject(ApiClientService); protected readonly auth = inject(AuthStore); private readonly branch = inject(BranchContextService);
  protected readonly devices = signal<Device[]>([]); protected readonly messages = signal<Message[]>([]); protected readonly results = signal<Result[]>([]); protected readonly deliveries = signal<Delivery[]>([]);
  protected readonly error = signal(''); protected readonly notice = signal(''); protected readonly busy = signal(false); protected readonly preview = signal<unknown>(null);
  protected readonly reference = signal<Reference | null>(null); protected readonly versions = signal<unknown[]>([]);
  protected name = 'Standard laboratory simulator'; protected deviceId = ''; protected mappingVersion = 'v1'; protected reason = '';
  protected sourceCode = 'GLU'; protected canonicalCode = 'GLUCOSE'; protected unit = 'mg/dL';
  protected messageId = ''; protected payload = ''; protected inboxStatus = '';
  protected readonly label = workspaceStateLabel;
  protected readonly badge = workspaceBadgeClass;
  protected readonly deviceOptions = computed(() => this.devices().map(d => ({ value: d.id, label: d.name })));
  protected readonly inboxStatusOptions = [{ value: '', label: 'All messages' }, ...['RECEIVED','QUARANTINED','STAGED','RELEASED','REJECTED'].map(value => ({ value, label: workspaceStateLabel(value) }))];
  private generation = 0; private loadGeneration = 0;
  constructor() { effect(() => { this.branch.selectedBranchCode(); this.generation++; this.deviceId = ''; this.payload = ''; this.messageId = ''; this.reason = ''; this.notice.set(''); this.preview.set(null); this.versions.set([]); this.reference.set(null); this.devices.set([]); this.messages.set([]); this.results.set([]); this.deliveries.set([]); void this.refresh(); }); }
  protected async refresh() {
    const generation = this.generation; const load = ++this.loadGeneration; this.busy.set(true); this.error.set('');
    try {
      const [devices, messages, deliveries, reference, results] = await Promise.all([
        this.get<Device[]>('/integrations/devices'), this.get<Message[]>('/integrations/inbox' + (this.inboxStatus ? '?status=' + encodeURIComponent(this.inboxStatus) : '')),
        this.get<Delivery[]>('/integrations/outbox'), this.get<Reference>('/integrations/reference-profile'),
        this.auth.hasPermission('Integrations.Review') ? this.get<Result[]>('/integrations/results') : Promise.resolve([])
      ]);
      if (generation !== this.generation || load !== this.loadGeneration) return;
      this.devices.set(devices); this.messages.set(messages); this.deliveries.set(deliveries); this.reference.set(reference); this.results.set(results);
    } catch (e) { if (generation === this.generation && load === this.loadGeneration) this.error.set(this.message(e)); }
    finally { if (generation === this.generation && load === this.loadGeneration) this.busy.set(false); }
  }
  protected async register() {
    const ref = this.reference(); if (!ref) return;
    const id = crypto.randomUUID();
    await this.write('/integrations/devices', { name: this.name, profile: { deviceId: id, hospitalId: ref.hospitalId, branchCode: ref.branch, department: 'LAB', manufacturer: 'STANDARD-REFERENCE', model: 'ORU-R01-SIMULATOR', firmware: 'reference-v1', protocol: 1, transport: 1, capabilities: 1, interfaceVersion: '2.5.1', mappingVersion: this.mappingVersion, simulationOnly: true } }, 'Reference device registered. Add its mapping before processing.');
  }
  protected async active(device: Device) { await this.write(`/integrations/devices/${device.id}/active`, { active: !device.active }, 'Device status updated.'); }
  protected async saveMapping() { await this.write(`/integrations/devices/${this.deviceId}/mappings`, { version: this.mappingVersion, rules: [{ sourceCode: this.sourceCode, sourceUnit: this.unit, code: this.canonicalCode, unit: this.unit }] }, 'Immutable mapping version saved.'); await this.loadMappings(); }
  protected async loadMappings() {
    const generation = this.generation; const device = this.deviceId; this.versions.set([]);
    if (!device) return;
    try { const versions = await this.get<unknown[]>(`/integrations/devices/${device}/mappings`); if (generation === this.generation && device === this.deviceId) this.versions.set(versions); }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
  }
  protected async previewMessage() {
    const generation = this.generation; this.error.set('');
    try { const result = await firstValueFrom(this.api.post<Response<unknown>>('/integrations/preview', this.envelope())); if (!result.success) throw new Error(result.message); if (generation === this.generation) this.preview.set(result.data); }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
  }
  protected async ingest() { await this.write('/integrations/inbox', this.envelope(), 'Message durably received. Process it from the inbox.'); }
  protected async process(message: Message) { await this.write(`/integrations/inbox/${message.id}/process`, { reason: this.reason }, 'Processing finished. Check status and quarantine reason.'); }
  protected async review(result: Result, accept: boolean) { await this.write(`/integrations/results/${result.id}/review`, { accept, reason: this.reason }, accept ? 'Simulation result reviewed and order completed.' : 'Result rejected.'); }
  protected async replay(delivery: Delivery) { await this.write(`/integrations/outbox/${delivery.id}/replay`, { reason: this.reason }, 'Delivery returned to the pending queue.'); }
  protected observations(value: unknown): unknown { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return 'Unavailable'; } }
  private envelope() { return { deviceId: this.deviceId, mappingVersion: this.mappingVersion, messageId: this.messageId, payload: this.payload.replace(/\r?\n/g, '\r') }; }
  private async write(path: string, body: unknown, notice: string) {
    if (this.busy()) return; const generation = this.generation; this.busy.set(true); this.error.set(''); this.notice.set('');
    try { const result = await firstValueFrom(this.api.post<Response<unknown>>(path, body)); if (!result.success) throw new Error(result.message); if (generation === this.generation) { this.notice.set(notice); await this.refresh(); } }
    catch (e) { if (generation === this.generation) this.error.set(this.message(e)); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  private async get<T>(path: string): Promise<T> { const result = await firstValueFrom(this.api.get<Response<T>>(path)); if (!result.success || result.data === null) throw new Error(result.message); return result.data; }
  private message(e: unknown) { return e instanceof Error ? e.message : 'Unable to complete the request.'; }
}

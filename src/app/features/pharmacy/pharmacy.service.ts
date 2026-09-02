import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { DispenseLine, DrugInteractionBehavior, DrugInteractionOptions, DrugInteractionRule, DrugInteractionSeverity, DrugMasterOptions, FormularyOptions, FormularyPolicy, FormularyStatus, Medicine, PharmacyDashboard, PrescriptionDetail, PrescriptionQueueItem, ReceiveBatchRequest, RecentDispensing, SaveDrugInteractionRequest, SaveFormularyPolicyRequest, SaveGenericDrugRequest, SaveMedicineRequest, StockBatch } from './pharmacy.models';

@Injectable({ providedIn: 'root' })
export class PharmacyService {
  private readonly api = inject(ApiClientService);
  dashboard() { return this.get<PharmacyDashboard>('/pharmacy/dashboard'); }
  prescriptions(search = '', status = '') { return this.get<PrescriptionQueueItem[]>(`/pharmacy/prescriptions?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`); }
  prescription(id: string) { return this.get<PrescriptionDetail>(`/pharmacy/prescriptions/${id}`); }
  dispensings(search = '') { return this.get<RecentDispensing[]>(`/pharmacy/dispensings?search=${encodeURIComponent(search)}`); }
  medicines(search = '') { return this.get<Medicine[]>(`/pharmacy/medicines?search=${encodeURIComponent(search)}`); }
  drugMasterOptions() { return this.get<DrugMasterOptions>('/pharmacy/drug-master/options'); }
  createGenericDrug(body: SaveGenericDrugRequest) { return this.post<{ id: string }>('/pharmacy/generic-drugs', body); }
  updateGenericDrug(id: string, body: SaveGenericDrugRequest) { return this.put<{ id: string }>(`/pharmacy/generic-drugs/${id}`, body); }
  createMasterOption(type: 'dosage-forms' | 'routes' | 'categories' | 'manufacturers', body: { code: string; name: string; isActive: boolean; displayOrder: number }) { return this.post<{ id: string }>(`/pharmacy/drug-master/${type}`, body); }
  createMedicine(body: SaveMedicineRequest) { return this.post<{ id: string }>('/pharmacy/medicines', body); }
  updateMedicine(id: string, body: SaveMedicineRequest) { return this.put<{ id: string }>(`/pharmacy/medicines/${id}`, body); }
  formulary(search = '', status: FormularyStatus | '' = '', department = '') { return this.get<FormularyPolicy[]>(`/pharmacy/formulary?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&department=${encodeURIComponent(department)}`); }
  formularyOptions() { return this.get<FormularyOptions>('/pharmacy/formulary/options'); }
  saveFormularyPolicy(medicineId: string, body: SaveFormularyPolicyRequest) { return this.put<{ id: string; medicineId: string; statusCode: string }>(`/pharmacy/formulary/${medicineId}`, body); }
  interactions(search = '', severity: DrugInteractionSeverity | '' = '', behavior: DrugInteractionBehavior | '' = '') { return this.get<DrugInteractionRule[]>(`/pharmacy/interactions?search=${encodeURIComponent(search)}&severity=${encodeURIComponent(severity)}&behavior=${encodeURIComponent(behavior)}`); }
  interactionOptions() { return this.get<DrugInteractionOptions>('/pharmacy/interactions/options'); }
  createInteraction(body: SaveDrugInteractionRequest) { return this.post<{ id: string }>('/pharmacy/interactions', body); }
  updateInteraction(id: string, body: SaveDrugInteractionRequest) { return this.put<{ id: string }>(`/pharmacy/interactions/${id}`, body); }
  stock(search = '', state = '') { return this.get<StockBatch[]>(`/pharmacy/stock?search=${encodeURIComponent(search)}&state=${encodeURIComponent(state)}`); }
  receiveBatch(body: ReceiveBatchRequest) { return this.post<{ id: string }>('/pharmacy/stock/batches', body); }
  dispense(prescriptionId: string, items: DispenseLine[], notes = '') { return this.post<{ id: string; dispenseNumber: string; saleNumber: string; totalAmount: number }>('/pharmacy/dispensings', { prescriptionId, locationId: null, notes, items }); }
  private async get<T>(path:string):Promise<T>{return unwrap(await firstValueFrom(this.api.get<PharmacyApiResponse<T>|T>(path)));}
  private async post<T>(path:string,body:unknown):Promise<T>{return unwrap(await firstValueFrom(this.api.post<PharmacyApiResponse<T>|T>(path,body)));}
  private async put<T>(path:string,body:unknown):Promise<T>{return unwrap(await firstValueFrom(this.api.put<PharmacyApiResponse<T>|T>(path,body)));}
}

interface PharmacyApiResponse<T>{success:boolean;statusCode:number;message:string;data:T|null;errors?:unknown[];}
function unwrap<T>(value:PharmacyApiResponse<T>|T):T{if(value&&typeof value==='object'&&'success' in value){const response=value as PharmacyApiResponse<T>;if(!response.success||response.data===null)throw response;return response.data;}return value as T;}

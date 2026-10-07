import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';

export interface StoreItem { id:string; branch:string; name:string; category:string; unit:string; onHand:number; reorderLevel:number; unitCost:number; active:boolean; }
export interface Vendor { id:string; branch:string; name:string; phone:string; email:string; address:string; gstin:string; active:boolean; }
export interface Asset { id:string; branch:string; number:string; name:string; category:string; status:string; location:string; serial:string; maintenanceDue:string|null; notes:string; }
export interface OrderLine { id:string; itemId:string; name:string; unit:string; quantity:number; rate:number; received:number; }
export interface PurchaseOrder { id:string; branch:string; number:string; vendorId:string; vendor:string; total:number; status:string; notes:string; createdAt:string; lines:OrderLine[]; }
export interface Movement { id:string; branch:string; item:string; unit:string; type:string; quantity:number; balance:number; reference:string; notes:string; department:string|null; patientMrn:string|null; actor:string; createdAt:string; }
export interface InventoryWorkspace { items:StoreItem[]; vendors:Vendor[]; assets:Asset[]; orders:PurchaseOrder[]; movements:Movement[]; departments:{id:string;name:string}[]; }
export const emptyWorkspace = ():InventoryWorkspace => ({items:[],vendors:[],assets:[],orders:[],movements:[],departments:[]});

@Injectable({providedIn:'root'})
export class InventoryService {
  private readonly api = inject(ApiClientService);
  workspace() { return this.get<InventoryWorkspace>('/inventory/workspace'); }
  async save(type:'items'|'vendors'|'assets', id:string|null, body:unknown) {
    return unwrap<{id:string}>(await firstValueFrom(id ? this.api.put(`/inventory/${type}/${id}`,body) : this.api.post(`/inventory/${type}`,body)));
  }
  async command(path:string, body:unknown) { return unwrap<{id:string}>(await firstValueFrom(this.api.post(`/inventory/${path}`,body))); }
  async editOrder(id:string,body:unknown) {return unwrap<{id:string}>(await firstValueFrom(this.api.put(`/inventory/purchase-orders/${id}`,body)));}
  private async get<T>(path:string) { return unwrap<T>(await firstValueFrom(this.api.get(path))); }
}
function unwrap<T>(value:unknown):T {
  if(value && typeof value==='object' && 'success' in value) {
    const r=value as {success:boolean;data:T;message:string}; if(!r.success) throw r; return r.data;
  }
  return value as T;
}

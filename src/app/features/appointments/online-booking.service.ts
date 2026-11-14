import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { ApiResponse } from '../../core/auth/auth.models';

export interface BookingLink { id: string; placement?:string; doctorId: string|null; departmentName: string|null; title: string; hospitalName: string; address: string; phone: string; instructions: string; active: boolean; version: number; maxAdvanceDays: number; cutoffMinutes: number; }
export interface BookingDoctor { id: string; name: string; department?: string; specialty?: string; fee?: number; }
export interface BookingSlot { id: string; version?:number;isBooked?:boolean; doctorId: string; startsAt: string; endsAt: string; }
export interface BookingArrival { id: string; reference: string; name: string; phone: string; patientId: string|null; arrivedAt: string|null; startsAt: string; status: string; doctor: string; }
export interface BookingBoard { links: BookingLink[]; slots: BookingSlot[]; arrivals: BookingArrival[]; doctors: BookingDoctor[]; messages: {kind:string;status:string;count:number}[];affected?:{id:string;reference:string;startsAt:string;doctor:string}[];performance?:{id:string;title:string;placement:string;views:number;booked:number;arrived:number;registered:number;noShow:number;cancelled:number}[]; }
export interface PublicBookingProfile { id:string;bookingEnabled?:boolean;title:string;hospitalName:string;address:string;phone:string;instructions:string;branch:string;doctors:BookingDoctor[]; }
export interface BookingConfirmation {id:string;reference:string;name:string;startsAt:string;endsAt?:string|null;doctorId?:string;status:string;registration:string;}

@Injectable({providedIn:'root'})
export class OnlineBookingService {
  private readonly api=inject(ApiClientService);
  async get<T>(path:string):Promise<T> { return this.unwrap(await firstValueFrom(this.api.get<ApiResponse<T>>(path))); }
  async post<T>(path:string,body:unknown):Promise<T> { return this.unwrap(await firstValueFrom(this.api.post<ApiResponse<T>>(path,body))); }
  private unwrap<T>(r:ApiResponse<T>):T { if(!r.success||r.data==null){const message=r.errors?.map(e=>e.code).filter(Boolean).join(' ')||r.message||'Unable to complete booking. Please try again.';throw new Error(/^[A-Z0-9_ ]+$/.test(message)?message.charAt(0)+message.slice(1).toLowerCase().replaceAll('_',' '):message);} return r.data; }
}

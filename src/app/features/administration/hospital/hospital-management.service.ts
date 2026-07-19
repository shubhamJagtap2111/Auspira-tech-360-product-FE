import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';
import { HospitalApiResponse, HospitalBranding, HospitalProfile, HospitalSetting } from './hospital-management.models';

@Injectable({ providedIn: 'root' })
export class HospitalManagementService {
  private readonly api = inject(ApiClientService);

  getProfile(): Promise<HospitalApiResponse<HospitalProfile>> {
    return firstValueFrom(this.api.get<HospitalApiResponse<HospitalProfile>>('/administration/hospital'));
  }

  updateProfile(profile: HospitalProfile): Promise<HospitalApiResponse<HospitalProfile>> {
    return firstValueFrom(this.api.put<HospitalApiResponse<HospitalProfile>>('/administration/hospital', createProfilePayload(profile)));
  }

  updateBranding(branding: HospitalBranding): Promise<HospitalApiResponse<HospitalProfile>> {
    return firstValueFrom(this.api.put<HospitalApiResponse<HospitalProfile>>('/administration/hospital/branding', branding));
  }

  updateSettings(settings: HospitalSetting[]): Promise<HospitalApiResponse<HospitalProfile>> {
    return firstValueFrom(this.api.put<HospitalApiResponse<HospitalProfile>>('/administration/hospital/settings', { settings }));
  }
}

function createProfilePayload(profile: HospitalProfile) {
  return {
    hospitalCode: profile.hospitalCode,
    hospitalName: profile.hospitalName,
    legalName: profile.legalName || null,
    shortName: profile.shortName || null,
    websiteUrl: profile.websiteUrl || null,
    establishedDate: profile.establishedDate || null,
    primaryLanguageCode: profile.primaryLanguageCode,
    timeZoneCode: profile.timeZoneCode,
    currencyCode: profile.currencyCode,
    address: profile.address,
    contact: profile.contact,
    license: profile.license,
    gst: profile.gst,
    subscription: profile.subscription,
    rowVersion: profile.rowVersion
  };
}

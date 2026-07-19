import { ApiResponse } from '../../../core/auth/auth.models';

export type HospitalApiResponse<T> = ApiResponse<T>;

export interface HospitalProfile {
  hospitalGuid: string;
  hospitalCode: string;
  hospitalName: string;
  legalName: string | null;
  shortName: string | null;
  websiteUrl: string | null;
  establishedDate: string | null;
  primaryLanguageCode: string;
  timeZoneCode: string;
  currencyCode: string;
  address: HospitalAddress;
  contact: HospitalContact;
  license: HospitalLicense;
  gst: HospitalGst;
  branding: HospitalBranding;
  subscription: HospitalSubscription;
  settings: HospitalSetting[];
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface HospitalAddress {
  addressLine1: string;
  addressLine2: string | null;
  cityName: string;
  stateName: string;
  countryCode: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface HospitalContact {
  primaryPhone: string;
  secondaryPhone: string | null;
  emergencyPhone: string | null;
  email: string;
  fax: string | null;
}

export interface HospitalLicense {
  licenseNumber: string | null;
  licenseType: string | null;
  issuingAuthority: string | null;
  validFrom: string | null;
  validTo: string | null;
  documentUrl: string | null;
}

export interface HospitalGst {
  gstin: string | null;
  legalBusinessName: string | null;
  registrationState: string | null;
  registrationDate: string | null;
}

export interface HospitalBranding {
  logoUrl: string | null;
  logoFileName: string | null;
  logoContentType: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface HospitalSubscription {
  planCode: string;
  planNameKey: string;
  statusCode: string;
  startDate: string | null;
  endDate: string | null;
  maxUsers: number | null;
  maxBranches: number | null;
}

export interface HospitalSetting {
  settingKey: string;
  settingValue: string | null;
  dataType: string;
  descriptionKey: string | null;
  modifiedDate?: string | null;
  isActive?: boolean;
}

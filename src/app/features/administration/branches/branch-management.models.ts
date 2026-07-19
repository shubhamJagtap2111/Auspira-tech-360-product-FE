import { ApiResponse } from '../../../core/auth/auth.models';

export type BranchApiResponse<T> = ApiResponse<T>;

export interface BranchSummary {
  branchGuid: string;
  hospitalGuid: string;
  branchCode: string;
  branchName: string;
  branchTypeCode: string;
  isDefault: boolean;
  cityName: string | null;
  stateName: string | null;
  countryCode: string | null;
  primaryPhone: string | null;
  email: string | null;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface BranchProfile {
  branchGuid: string;
  hospitalGuid: string;
  branchCode: string;
  branchName: string;
  branchTypeCode: string;
  isDefault: boolean;
  address: BranchAddress;
  contact: BranchContact;
  workingHours: BranchWorkingHour[];
  configuration: BranchConfiguration[];
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface BranchAddress {
  addressLine1: string;
  addressLine2: string | null;
  cityName: string;
  stateName: string;
  countryCode: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface BranchContact {
  primaryPhone: string;
  secondaryPhone: string | null;
  emergencyPhone: string | null;
  email: string;
  fax: string | null;
}

export interface BranchWorkingHour {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  notes: string | null;
  isActive: boolean;
}

export interface BranchConfiguration {
  settingKey: string;
  settingValue: string | null;
  dataType: string;
  descriptionKey: string | null;
  modifiedDate?: string | null;
  isActive: boolean;
}

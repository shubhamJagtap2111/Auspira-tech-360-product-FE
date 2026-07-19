import { ApiResponse } from '../../../core/auth/auth.models';

export type OrganizationApiResponse<T> = ApiResponse<T>;

export interface Department {
  departmentGuid: string;
  hospitalGuid: string;
  branchGuid: string | null;
  branchCode: string | null;
  branchName: string | null;
  departmentCode: string;
  departmentName: string;
  descriptionKey: string | null;
  departmentHeadUserGuid: string | null;
  departmentHeadName: string | null;
  sortOrder: number;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

export interface Designation {
  designationGuid: string;
  hospitalGuid: string;
  designationCode: string;
  designationName: string;
  descriptionKey: string | null;
  parentDesignationGuid: string | null;
  parentDesignationCode: string | null;
  parentDesignationName: string | null;
  levelNo: number;
  sortOrder: number;
  isActive: boolean;
  createdDate: string | null;
  modifiedDate: string | null;
  rowVersion: string;
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ApiClientService } from '../http/api-client.service';

export const selectedBranchStorageKey = 'care360.selectedBranchCode';
const hospitalNameStorageKey = 'care360.hospitalName';

interface BranchApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
}

interface HospitalProfileResponse {
  hospitalName: string | null;
}

export interface BranchContextOption {
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
}

@Injectable({ providedIn: 'root' })
export class BranchContextService {
  private readonly api = inject(ApiClientService);
  private readonly authStore = inject(AuthStore);
  private readonly branchesSignal = signal<BranchContextOption[]>([]);
  private readonly organizationAccessSignal = signal(false);
  readonly organizationAccess = this.organizationAccessSignal.asReadonly();
  private readonly selectedBranchCodeSignal = signal<string | null>(readSelectedBranchCode());
  private readonly hospitalNameSignal = signal<string | null>(readStoredHospitalName(this.authStore.session()?.tenantCode));
  private loadingPromise: Promise<void> | null = null;
  private loadedBranchesSuccessfully = false;
  private hospitalNameRevision = 0;

  readonly branches = this.branchesSignal.asReadonly();
  readonly selectedBranchCode = this.selectedBranchCodeSignal.asReadonly();
  readonly selectedBranch = computed(() => {
    const branches = this.branchesSignal();
    const selectedCode = this.selectedBranchCodeSignal();
    if (selectedCode === 'ALL') return null;
    return findBranch(branches, selectedCode)
      ?? branches.find(branch => branch.isDefault && branch.isActive)
      ?? branches.find(branch => branch.isActive)
      ?? branches[0]
      ?? null;
  });

  readonly hospitalName = computed(() =>
    this.hospitalNameSignal()
    || this.authStore.profile()?.hospitalName?.trim()
    || this.authStore.session()?.hospitalName?.trim()
    || 'Auspira Care360'
  );

  loadBranches(): Promise<void> {
    this.loadingPromise ??= this.fetchContext().finally(() => {
      if (!this.loadedBranchesSuccessfully) {
        this.loadingPromise = null;
      }
    });
    return this.loadingPromise;
  }

  async refresh(): Promise<void> {
    this.loadedBranchesSuccessfully = false;
    this.loadingPromise = this.fetchContext().finally(() => {
      if (!this.loadedBranchesSuccessfully) {
        this.loadingPromise = null;
      }
    });
    await this.loadingPromise;
  }

  async refreshHospitalName(): Promise<void> {
    await this.fetchHospitalName();
  }

  setHospitalName(hospitalName: string | null | undefined): void {
    ++this.hospitalNameRevision;
    const normalized = hospitalName?.trim();
    if (normalized) {
      this.hospitalNameSignal.set(normalized);
      writeStoredHospitalName(this.authStore.session()?.tenantCode, normalized);
    }
  }

  setSelectedBranchCode(branchCode: string | null): void {
    const normalized = normalizeBranchCode(branchCode);
    const branch = findBranch(this.branchesSignal(), normalized);
    if (!branch && !(normalized === 'ALL' && this.organizationAccessSignal())) return;
    const nextCode = branch?.branchCode ?? 'ALL';
    if (nextCode === this.selectedBranchCodeSignal()) {
      return;
    }

    this.selectedBranchCodeSignal.set(nextCode);
    writeSelectedBranchCode(nextCode);
  }

  private async fetchContext(): Promise<void> {
    await Promise.all([
      this.fetchBranches(),
      this.fetchHospitalName()
    ]);
  }

  private async fetchHospitalName(): Promise<void> {
    const revision = this.hospitalNameRevision;
    try {
      const response = await firstValueFrom(
        this.api.get<BranchApiResponse<HospitalProfileResponse>>('/administration/hospital')
      );
      const hospitalName = response.success ? response.data?.hospitalName?.trim() : null;
      if (hospitalName && revision === this.hospitalNameRevision) {
        this.hospitalNameSignal.set(hospitalName);
        writeStoredHospitalName(this.authStore.session()?.tenantCode, hospitalName);
      }
    } catch {
      // Keep the last saved name during temporary network failures.
    }
  }

  private async fetchBranches(): Promise<void> {
    let response: BranchApiResponse<{ organizationAccess: boolean; branches: BranchContextOption[] }>;
    try {
      response = await firstValueFrom(
        this.api.get<BranchApiResponse<{ organizationAccess: boolean; branches: BranchContextOption[] }>>('/administration/branch-context')
      );
    } catch {
      this.clearUnavailableContext();
      return;
    }

    if (!response.success || !response.data) {
      this.clearUnavailableContext();
      return;
    }

    const branches = response.data.branches.filter(branch => branch.isActive);
    this.organizationAccessSignal.set(response.data.organizationAccess);
    this.loadedBranchesSuccessfully = true;
    this.branchesSignal.set(branches);
    const storedCode = readSelectedBranchCode();
    const profileCode = normalizeBranchCode(this.authStore.profile()?.branchCode);
    if (storedCode === 'ALL' && response.data.organizationAccess) {
      this.selectedBranchCodeSignal.set('ALL');
      return;
    }
    const nextBranch = findBranch(branches, storedCode)
      ?? findBranch(branches, profileCode)
      ?? branches.find(branch => branch.isDefault)
      ?? branches[0]
      ?? null;

    this.selectedBranchCodeSignal.set(nextBranch?.branchCode ?? null);
    writeSelectedBranchCode(nextBranch?.branchCode ?? null);
  }

  private clearUnavailableContext(): void {
    this.branchesSignal.set([]);
    this.organizationAccessSignal.set(false);
    this.selectedBranchCodeSignal.set(null);
    writeSelectedBranchCode(null);
  }
}

function findBranch(branches: BranchContextOption[], branchCode: string | null): BranchContextOption | null {
  if (!branchCode) {
    return null;
  }

  return branches.find(branch => branch.branchCode.localeCompare(branchCode, undefined, { sensitivity: 'accent' }) === 0) ?? null;
}

function normalizeBranchCode(branchCode: string | null | undefined): string | null {
  const value = branchCode?.trim();
  return value ? value.toUpperCase() : null;
}

function readSelectedBranchCode(): string | null {
  try {
    return normalizeBranchCode(typeof window === 'undefined' ? null : window.localStorage.getItem(selectedBranchStorageKey));
  } catch {
    return null;
  }
}

function readStoredHospitalName(tenantCode: string | null | undefined): string | null {
  try {
    const value = typeof window === 'undefined' ? null : window.localStorage.getItem(hospitalNameStorageKeyForTenant(tenantCode))?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeStoredHospitalName(tenantCode: string | null | undefined, hospitalName: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(hospitalNameStorageKeyForTenant(tenantCode), hospitalName);
    }
  } catch {
    // Hospital name still updates in memory when browser storage is unavailable.
  }
}

function hospitalNameStorageKeyForTenant(tenantCode: string | null | undefined): string {
  const normalized = tenantCode?.trim().toLowerCase();
  return normalized ? `${hospitalNameStorageKey}.${normalized}` : hospitalNameStorageKey;
}

function writeSelectedBranchCode(branchCode: string | null): void {
  try {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    if (!storage) {
      return;
    }

    if (branchCode) {
      storage.setItem(selectedBranchStorageKey, branchCode);
    } else {
      storage.removeItem(selectedBranchStorageKey);
    }
  } catch {
    // Branch context remains usable in memory when browser storage is unavailable.
  }
}

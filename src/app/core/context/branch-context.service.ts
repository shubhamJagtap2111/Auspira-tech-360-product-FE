import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ApiClientService } from '../http/api-client.service';

export const selectedBranchStorageKey = 'care360.selectedBranchCode';

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
  private readonly selectedBranchCodeSignal = signal<string | null>(readSelectedBranchCode());
  private readonly hospitalNameSignal = signal<string | null>(null);
  private loadingPromise: Promise<void> | null = null;

  readonly branches = this.branchesSignal.asReadonly();
  readonly selectedBranchCode = this.selectedBranchCodeSignal.asReadonly();
  readonly selectedBranch = computed(() => {
    const branches = this.branchesSignal();
    const selectedCode = this.selectedBranchCodeSignal();
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
    this.loadingPromise ??= this.fetchContext();
    return this.loadingPromise;
  }

  async refresh(): Promise<void> {
    this.loadingPromise = this.fetchContext();
    await this.loadingPromise;
  }

  async refreshHospitalName(): Promise<void> {
    await this.fetchHospitalName();
  }

  setSelectedBranchCode(branchCode: string | null): void {
    const normalized = normalizeBranchCode(branchCode);
    const branch = findBranch(this.branchesSignal(), normalized);
    const nextCode = branch?.branchCode ?? normalized;
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
    try {
      const response = await firstValueFrom(
        this.api.get<BranchApiResponse<HospitalProfileResponse>>('/administration/hospital')
      );
      const hospitalName = response.success ? response.data?.hospitalName?.trim() : null;
      if (hospitalName) {
        this.hospitalNameSignal.set(hospitalName);
      }
    } catch {
      this.hospitalNameSignal.set(
        this.authStore.profile()?.hospitalName?.trim()
        || this.authStore.session()?.hospitalName?.trim()
        || null
      );
    }
  }

  private async fetchBranches(): Promise<void> {
    let response: BranchApiResponse<BranchContextOption[]>;
    try {
      response = await firstValueFrom(
        this.api.get<BranchApiResponse<BranchContextOption[]>>('/administration/branches?includeInactive=false')
      );
    } catch {
      this.applyProfileFallback();
      return;
    }

    if (!response.success || !response.data) {
      this.applyProfileFallback();
      return;
    }

    const branches = response.data.filter(branch => branch.isActive);
    this.branchesSignal.set(branches);
    const storedCode = readSelectedBranchCode();
    const profileCode = normalizeBranchCode(this.authStore.profile()?.branchCode);
    const nextBranch = findBranch(branches, storedCode)
      ?? findBranch(branches, profileCode)
      ?? branches.find(branch => branch.isDefault)
      ?? branches[0]
      ?? null;

    this.selectedBranchCodeSignal.set(nextBranch?.branchCode ?? profileCode);
    writeSelectedBranchCode(nextBranch?.branchCode ?? profileCode);
  }

  private applyProfileFallback(): void {
    const profileCode = normalizeBranchCode(this.authStore.profile()?.branchCode);
    if (!this.selectedBranchCodeSignal() && profileCode) {
      this.selectedBranchCodeSignal.set(profileCode);
      writeSelectedBranchCode(profileCode);
    }
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

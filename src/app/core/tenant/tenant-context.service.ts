import { Injectable, signal } from '@angular/core';

const DEFAULT_TENANT_CODE = 'auspira-demo';
const RESERVED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  'auspira-tech-360-product-fe.vercel.app'
]);
const RESERVED_TENANT_CODES = new Set([
  'auspira-tech-360-product-fe'
]);

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly tenantCode = signal(resolveTenantCode());
  readonly cultureCode = signal(resolveCultureCode());

  setTenantCode(tenantCode: string): void {
    const normalizedTenantCode = tenantCode.trim();
    if (!normalizedTenantCode) {
      return;
    }

    window.localStorage.setItem('care360.tenantCode', normalizedTenantCode);
    this.tenantCode.set(normalizedTenantCode);
  }

  setCulture(cultureCode: string): void {
    const normalizedCultureCode = cultureCode.trim();
    if (!normalizedCultureCode) {
      return;
    }

    window.localStorage.setItem('care360.cultureCode', normalizedCultureCode);
    this.cultureCode.set(normalizedCultureCode);
  }
}

function resolveTenantCode(): string {
  const queryTenantCode = new URLSearchParams(window.location.search).get('tenantCode')?.trim();
  const storedTenantCode = window.localStorage.getItem('care360.tenantCode')?.trim();
  const usableStoredTenantCode = storedTenantCode && !isReservedTenantCode(storedTenantCode)
    ? storedTenantCode
    : null;
  const subdomainTenantCode = resolveSubdomainTenantCode(window.location.hostname);

  return queryTenantCode || usableStoredTenantCode || subdomainTenantCode || DEFAULT_TENANT_CODE;
}

function resolveCultureCode(): string {
  return window.localStorage.getItem('care360.cultureCode') ?? 'en-US';
}

function resolveSubdomainTenantCode(hostname: string): string | null {
  const normalizedHostname = hostname.toLowerCase();
  if (RESERVED_HOSTNAMES.has(normalizedHostname) || normalizedHostname.endsWith('.vercel.app')) {
    return null;
  }

  const [firstSegment] = normalizedHostname.split('.');
  return firstSegment || null;
}

function isReservedTenantCode(tenantCode: string): boolean {
  return RESERVED_TENANT_CODES.has(tenantCode.toLowerCase());
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly tenantCode = signal(resolveTenantCode());
  readonly cultureCode = signal('en-US');

  setTenantCode(tenantCode: string): void {
    const normalizedTenantCode = tenantCode.trim();
    if (!normalizedTenantCode) {
      return;
    }

    window.localStorage.setItem('care360.tenantCode', normalizedTenantCode);
    this.tenantCode.set(normalizedTenantCode);
  }

  setCulture(cultureCode: string): void {
    this.cultureCode.set(cultureCode);
  }
}

function resolveTenantCode(): string {
  const queryTenantCode = new URLSearchParams(window.location.search).get('tenantCode');
  const storedTenantCode = window.localStorage.getItem('care360.tenantCode');
  const subdomainTenantCode = resolveSubdomainTenantCode(window.location.hostname);

  return queryTenantCode ?? storedTenantCode ?? subdomainTenantCode ?? 'auspira-demo';
}

function resolveSubdomainTenantCode(hostname: string): string | null {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  const [firstSegment] = hostname.split('.');
  return firstSegment || null;
}

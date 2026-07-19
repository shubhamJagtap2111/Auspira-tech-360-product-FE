import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly tenantId = signal('11111111-1111-1111-1111-111111111111');
  readonly cultureCode = signal('en-US');

  setCulture(cultureCode: string): void {
    this.cultureCode.set(cultureCode);
  }
}

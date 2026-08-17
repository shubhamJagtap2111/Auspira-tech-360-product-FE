import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocaleContextService {
  readonly cultureCode = signal(
    window.localStorage.getItem('care360.cultureCode') ?? 'en-US'
  );

  setCulture(cultureCode: string): void {
    const normalized = cultureCode.trim();
    if (!normalized) {
      return;
    }

    window.localStorage.setItem('care360.cultureCode', normalized);
    this.cultureCode.set(normalized);
  }
}

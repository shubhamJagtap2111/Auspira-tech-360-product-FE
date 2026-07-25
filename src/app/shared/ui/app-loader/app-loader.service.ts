import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppLoaderService {
  private readonly activeRequests = signal(0);
  private readonly visible = signal(false);
  private showTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isVisible = computed(() => this.visible());

  show(): void {
    this.activeRequests.update(count => count + 1);

    if (this.visible() || this.showTimer) {
      return;
    }

    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.activeRequests() > 0) {
        this.visible.set(true);
      }
    }, 180);
  }

  hide(): void {
    this.activeRequests.update(count => Math.max(0, count - 1));

    if (this.activeRequests() > 0) {
      return;
    }

    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    this.visible.set(false);
  }

  reset(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    this.activeRequests.set(0);
    this.visible.set(false);
  }
}

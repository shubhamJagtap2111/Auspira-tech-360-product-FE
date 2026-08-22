import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppLoaderService {
  private readonly activeRequests = signal(0);
  private readonly visible = signal(false);
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isVisible = computed(() => this.visible());

  show(): void {
    this.activeRequests.update(count => count + 1);

    if (this.visible() || this.showTimer) {
      this.scheduleEmergencyReset();
      return;
    }

    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.activeRequests() > 0) {
        this.visible.set(true);
        this.scheduleEmergencyReset();
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

    this.clearEmergencyReset();
    this.visible.set(false);
  }

  reset(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    this.clearEmergencyReset();
    this.activeRequests.set(0);
    this.visible.set(false);
  }

  private scheduleEmergencyReset(): void {
    if (this.resetTimer) {
      return;
    }

    this.resetTimer = setTimeout(() => this.reset(), 45_000);
  }

  private clearEmergencyReset(): void {
    if (!this.resetTimer) {
      return;
    }

    clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
}

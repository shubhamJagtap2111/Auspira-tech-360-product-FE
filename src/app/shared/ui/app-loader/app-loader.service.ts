import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppLoaderService {
  private static readonly ShowDelayMs = 180;
  private static readonly HideSettleMs = 220;
  private static readonly MinimumVisibleMs = 520;
  private static readonly EmergencyResetMs = 45_000;

  private readonly activeRequests = signal(0);
  private readonly visible = signal(false);
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private visibleSince = 0;

  readonly isVisible = computed(() => this.visible());

  show(): void {
    this.activeRequests.update(count => count + 1);

    this.clearHideTimer();

    if (this.visible() || this.showTimer) {
      this.scheduleEmergencyReset();
      return;
    }

    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.activeRequests() > 0) {
        this.visibleSince = Date.now();
        this.visible.set(true);
        this.scheduleEmergencyReset();
      }
    }, AppLoaderService.ShowDelayMs);
  }

  showImmediate(): void {
    this.activeRequests.update(count => count + 1);
    this.clearHideTimer();

    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    if (!this.visible()) {
      this.visibleSince = Date.now();
      this.visible.set(true);
    }

    this.scheduleEmergencyReset();
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

    this.scheduleHide();
  }

  reset(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    this.clearHideTimer();
    this.clearEmergencyReset();
    this.activeRequests.set(0);
    this.visibleSince = 0;
    this.visible.set(false);
  }

  private scheduleHide(): void {
    if (!this.visible()) {
      this.clearEmergencyReset();
      return;
    }

    if (this.hideTimer) {
      return;
    }

    const visibleForMs = Date.now() - this.visibleSince;
    const delayMs = Math.max(
      AppLoaderService.HideSettleMs,
      AppLoaderService.MinimumVisibleMs - visibleForMs
    );

    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.activeRequests() > 0) {
        return;
      }

      this.clearEmergencyReset();
      this.visibleSince = 0;
      this.visible.set(false);
    }, delayMs);
  }

  private scheduleEmergencyReset(): void {
    if (this.resetTimer) {
      return;
    }

    this.resetTimer = setTimeout(() => this.reset(), AppLoaderService.EmergencyResetMs);
  }

  private clearHideTimer(): void {
    if (!this.hideTimer) {
      return;
    }

    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private clearEmergencyReset(): void {
    if (!this.resetTimer) {
      return;
    }

    clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
}

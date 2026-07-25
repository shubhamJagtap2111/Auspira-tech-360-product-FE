import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLoaderService } from './app-loader.service';

@Component({
  selector: 'ac-app-loader',
  standalone: true,
  template: `
    @if (loader.isVisible()) {
      <div class="loader-overlay" aria-live="polite" aria-busy="true">
        <div class="loader-card">
          <div class="loading">
            <svg width="64px" height="48px" viewBox="0 0 64 48" role="img" aria-label="Loading">
              <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
              <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
            </svg>
          </div>
          <span>Working securely...</span>
        </div>
      </div>
    }
  `,
  styles: `
    .loader-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      pointer-events: all;
      background: color-mix(in srgb, var(--ac-bg) 52%, transparent);
      backdrop-filter: blur(3px);
      animation: loaderFade .16s ease;
    }

    .loader-card {
      min-width: 176px;
      min-height: 118px;
      display: grid;
      place-items: center;
      gap: 10px;
      padding: 22px 24px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 24%, var(--ac-border));
      border-radius: 8px;
      background: linear-gradient(180deg, var(--ac-surface), color-mix(in srgb, var(--ac-primary-light) 34%, var(--ac-surface)));
      box-shadow: 0 22px 60px rgba(15,23,42,.18);
    }

    .loader-card span {
      color: var(--ac-text-2);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .02em;
    }

    .loading svg polyline {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .loading svg polyline#back {
      stroke: color-mix(in srgb, var(--ac-primary) 18%, transparent);
    }

    .loading svg polyline#front {
      stroke: color-mix(in srgb, var(--ac-primary) 78%, var(--ac-secondary));
      stroke-dasharray: 48, 144;
      stroke-dashoffset: 192;
      animation: heartbeatDash 1.4s linear infinite;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--ac-primary) 38%, transparent));
    }

    :host-context(.dark) .loader-overlay {
      background: rgba(2,6,23,.42);
    }

    :host-context(.dark) .loader-card {
      background: linear-gradient(180deg, rgba(22,30,42,.96), rgba(15,23,42,.96));
      border-color: rgba(96,165,250,.26);
      box-shadow: 0 24px 70px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.05);
    }

    :host-context(.dark) .loader-card span {
      color: #cbd5e1;
    }

    @keyframes heartbeatDash {
      72.5% { opacity: 0; }
      to { stroke-dashoffset: 0; }
    }

    @keyframes loaderFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppLoaderComponent {
  protected readonly loader = inject(AppLoaderService);
}

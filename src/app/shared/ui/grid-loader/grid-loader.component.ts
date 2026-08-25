import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ac-grid-loader',
  standalone: true,
  template: `
    <div class="grid-loader" [class.compact]="compact" aria-live="polite" aria-busy="true">
      <div class="loader-card">
        <div class="loading" aria-hidden="true">
          <svg width="64px" height="48px" viewBox="0 0 64 48" role="img">
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" class="back"></polyline>
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" class="front"></polyline>
          </svg>
        </div>
        <span>Working securely...</span>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .grid-loader {
      position: fixed;
      top: var(--ac-header-h);
      right: 0;
      bottom: 0;
      left: var(--ac-sidebar-w);
      z-index: 1800;
      display: grid;
      place-items: center;
      padding: 24px;
      pointer-events: all;
      background: color-mix(in srgb, var(--ac-bg) 88%, transparent);
    }

    .grid-loader.compact {
      padding: 24px;
    }

    :host-context(.shell.collapsed) .grid-loader {
      left: var(--ac-sidebar-w-sm);
    }

    .loader-card {
      position: relative;
      z-index: 1;
      min-width: 166px;
      min-height: 108px;
      display: grid;
      place-items: center;
      gap: 8px;
      padding: 18px 22px;
      border: 1px solid color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--ac-surface) 96%, var(--ac-primary-light));
      box-shadow: 0 18px 42px rgba(15,23,42,.12);
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

    .loading svg polyline.back {
      stroke: color-mix(in srgb, var(--ac-primary) 18%, transparent);
    }

    .loading svg polyline.front {
      stroke: color-mix(in srgb, var(--ac-primary) 78%, var(--ac-secondary));
      stroke-dasharray: 48, 144;
      stroke-dashoffset: 192;
      animation: heartbeatDash 1.4s linear infinite;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--ac-primary) 38%, transparent));
    }

    :host-context(.dark) .loader-card {
      background: color-mix(in srgb, var(--ac-surface) 92%, var(--ac-bg));
      border-color: rgba(96,165,250,.26);
      box-shadow: 0 22px 58px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.05);
    }

    :host-context(.dark) .loader-card span {
      color: #cbd5e1;
    }

    :host-context(.dark) .grid-loader {
      background: rgba(2,6,23,.72);
    }

    @keyframes heartbeatDash {
      72.5% { opacity: 0; }
      to { stroke-dashoffset: 0; }
    }

    @media (max-width: 760px) {
      .grid-loader {
        top: 58px;
        right: 0;
        bottom: 68px;
        left: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcGridLoaderComponent {
  @Input() title = 'Working securely...';
  @Input() message = '';
  @Input() compact = false;
  @Input() showBrand = true;
}

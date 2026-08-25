import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ac-grid-loader',
  standalone: true,
  template: `
    <div class="grid-loader" [class.compact]="compact" aria-live="polite" aria-busy="true">
      <div class="pulse-wrap" aria-hidden="true">
        <svg viewBox="0 0 280 150" role="img">
          <path class="pulse-track" d="M10 76 H96 L108 118 L120 30 L145 126 L158 10 L181 100 L194 48 L204 82 L216 76 H270" />
          <path class="pulse-active" d="M96 76 L108 118 L120 30 L145 126 L158 10 L181 100 L194 48 L204 82" />
        </svg>
        @if (showBrand) {
          <div class="brand-card">
            <span class="material-symbols-rounded">health_and_safety</span>
            <strong>Care360</strong>
          </div>
        }
      </div>
      <div class="loader-copy">
        <strong>{{ title }}</strong>
        @if (message) {
          <span>{{ message }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .grid-loader {
      min-height: 260px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 14px;
      padding: 28px;
      color: var(--ac-muted);
      text-align: center;
      background: color-mix(in srgb, var(--ac-surface) 86%, transparent);
    }

    .grid-loader.compact {
      min-height: 160px;
      padding: 18px;
    }

    .pulse-wrap {
      position: relative;
      width: min(320px, 76vw);
      height: 170px;
      display: grid;
      place-items: center;
    }

    .pulse-wrap svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .pulse-track,
    .pulse-active {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .pulse-track {
      stroke: color-mix(in srgb, var(--ac-muted) 24%, transparent);
      stroke-width: 4;
    }

    .pulse-active {
      stroke: #166534;
      stroke-width: 4.5;
      stroke-dasharray: 210;
      stroke-dashoffset: 210;
      animation: gridHeartbeat 1.5s ease-in-out infinite;
      filter: drop-shadow(0 0 5px rgba(22, 101, 52, .2));
    }

    .brand-card {
      position: absolute;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      min-width: 118px;
      height: 52px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border-radius: 4px;
      color: color-mix(in srgb, var(--ac-muted) 62%, transparent);
      background: color-mix(in srgb, var(--ac-surface) 70%, transparent);
      backdrop-filter: blur(2px);
      font-size: 12px;
      font-weight: 900;
      opacity: .72;
    }

    .brand-card .material-symbols-rounded {
      font-size: 22px;
    }

    .loader-copy {
      display: grid;
      gap: 4px;
    }

    .loader-copy strong {
      color: var(--ac-text);
      font-size: 14px;
      font-weight: 900;
    }

    .loader-copy span {
      color: var(--ac-muted);
      font-size: 12.5px;
      font-weight: 750;
    }

    :host-context(.dark) .pulse-track {
      stroke: rgba(148, 163, 184, .28);
    }

    :host-context(.dark) .pulse-active {
      stroke: #22c55e;
      filter: drop-shadow(0 0 7px rgba(34, 197, 94, .26));
    }

    :host-context(.dark) .brand-card {
      background: rgba(15, 23, 42, .58);
      color: rgba(203, 213, 225, .68);
    }

    @keyframes gridHeartbeat {
      0% {
        stroke-dashoffset: 210;
        opacity: .2;
      }
      18% {
        opacity: 1;
      }
      58% {
        stroke-dashoffset: 0;
        opacity: 1;
      }
      100% {
        stroke-dashoffset: -210;
        opacity: .12;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcGridLoaderComponent {
  @Input() title = 'Loading records...';
  @Input() message = 'Preparing grid data.';
  @Input() compact = false;
  @Input() showBrand = true;
}

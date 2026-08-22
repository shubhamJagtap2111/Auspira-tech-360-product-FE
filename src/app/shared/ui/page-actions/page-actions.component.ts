import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ac-page-actions',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-actions">
      <a class="page-action back-action" [routerLink]="backLink">
        <span class="material-symbols-rounded">arrow_back</span>
        {{ backLabel }}
      </a>

      <button class="page-action refresh-action" type="button" (click)="refreshed.emit()">
        <span class="material-symbols-rounded">refresh</span>
        {{ refreshLabel }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 34px;
    }

    .page-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--ac-muted);
      font: inherit;
      font-size: 13.5px;
      font-weight: 850;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
      transition: background var(--ac-t), border-color var(--ac-t), color var(--ac-t), transform var(--ac-t), box-shadow var(--ac-t);
    }

    .page-action .material-symbols-rounded {
      font-size: 19px;
    }

    .back-action:hover {
      color: var(--ac-primary);
      background: var(--ac-primary-light);
      border-color: color-mix(in srgb, var(--ac-primary) 18%, var(--ac-border));
      transform: translateX(-2px);
    }

    .refresh-action {
      min-width: 116px;
      border-color: var(--ac-border);
      background: var(--ac-surface);
      color: var(--ac-text-3);
      cursor: pointer;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
    }

    .refresh-action:hover {
      color: var(--ac-primary);
      border-color: color-mix(in srgb, var(--ac-primary) 28%, var(--ac-border));
      box-shadow: 0 10px 24px color-mix(in srgb, var(--ac-primary) 12%, transparent);
      transform: translateY(-1px);
    }

    @media (max-width: 620px) {
      .page-actions {
        align-items: stretch;
        flex-direction: column;
        min-height: 0;
      }

      .page-action {
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcPageActionsComponent {
  @Input({ required: true }) backLink = '/';
  @Input({ required: true }) backLabel = 'Back';
  @Input() refreshLabel = 'Refresh';
  @Output() readonly refreshed = new EventEmitter<void>();
}

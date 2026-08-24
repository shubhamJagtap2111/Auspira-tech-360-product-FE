import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcDropdownComponent } from '../dropdown/dropdown.component';
import { ConfirmDialogState, DialogFormValues, DialogIntent, DialogService } from './dialog.service';

@Component({
  selector: 'ac-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
  template: `
    @if (dialogSvc.dialog(); as dialog) {
      <div class="dialog-backdrop" (click)="dismiss(dialog.dismissible)">
        <section
          class="dialog-card"
          [ngClass]="'intent-' + dialog.intent"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'dialog-title-' + dialog.id"
          [attr.aria-describedby]="'dialog-message-' + dialog.id"
          (click)="$event.stopPropagation()">
          <button
            class="dialog-close"
            type="button"
            title="Close"
            [disabled]="!dialog.dismissible"
            (click)="cancel()">
            <span class="material-symbols-rounded">close</span>
          </button>

          <div class="dialog-mark">
            <span class="material-symbols-rounded">{{ dialog.icon }}</span>
          </div>

          <div class="dialog-copy">
            <p class="dialog-kicker">{{ intentLabel(dialog.intent) }}</p>
            <h2 [id]="'dialog-title-' + dialog.id">{{ dialog.title }}</h2>
            <p [id]="'dialog-message-' + dialog.id">{{ dialog.message }}</p>
            @if (dialog.details) {
              <small>{{ dialog.details }}</small>
            }
          </div>

          @if (dialog.fields.length > 0) {
            <div class="dialog-form">
              @for (field of dialog.fields; track field.name) {
                <label>
                  <span>{{ field.label }} @if (field.required) { <em>*</em> }</span>
                  @switch (field.type) {
                    @case ('textarea') {
                      <textarea
                        [name]="field.name"
                        [rows]="field.rows || 3"
                        [placeholder]="field.placeholder || ''"
                        [(ngModel)]="field.value"></textarea>
                    }
                    @case ('select') {
                      <ac-dropdown
                        [attr.name]="field.name"
                        [(ngModel)]="field.value"
                        [options]="field.options || []"
                        [placeholder]="field.placeholder || 'Select'" />
                    }
                    @default {
                      <input
                        [type]="field.type || 'text'"
                        [name]="field.name"
                        [placeholder]="field.placeholder || ''"
                        [(ngModel)]="field.value" />
                    }
                  }
                </label>
              }
            </div>
          }

          <div class="dialog-actions">
            <button class="dialog-btn secondary" type="button" (click)="cancel()">
              {{ dialog.cancelText }}
            </button>
            <button class="dialog-btn primary" type="button" [disabled]="!isValid(dialog)" (click)="confirm(dialog)" autofocus>
              {{ dialog.confirmText }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      z-index: 10000;
    }

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(37,99,235,.18), transparent 34%),
        rgba(15,23,42,.54);
      backdrop-filter: blur(8px);
      animation: dialogFade .16s ease;
      z-index: 10000;
    }

    .dialog-card {
      position: relative;
      width: min(480px, 100%);
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--dialog-tone) 34%, var(--ac-border));
      border-radius: 8px;
      background: linear-gradient(180deg, var(--ac-surface), color-mix(in srgb, var(--dialog-soft) 34%, var(--ac-surface)));
      box-shadow: 0 24px 70px rgba(15,23,42,.28);
      animation: dialogIn .22s cubic-bezier(.16,1,.3,1);
      overflow: hidden;
    }

    .dialog-card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: var(--dialog-tone);
    }

    .intent-default,
    .intent-info {
      --dialog-tone: var(--ac-primary);
      --dialog-soft: var(--ac-primary-light);
    }

    .intent-danger {
      --dialog-tone: var(--ac-error);
      --dialog-soft: var(--ac-error-light);
    }

    .intent-warning {
      --dialog-tone: var(--ac-warning);
      --dialog-soft: var(--ac-warning-light);
    }

    .intent-success {
      --dialog-tone: var(--ac-success);
      --dialog-soft: var(--ac-success-light);
    }

    .dialog-close {
      position: absolute;
      top: 12px;
      right: 12px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      color: var(--ac-muted);
      transition: background var(--ac-t), color var(--ac-t);
    }

    .dialog-close:hover:not(:disabled) {
      background: var(--ac-surface-2);
      color: var(--ac-text);
    }

    .dialog-close:disabled {
      opacity: .38;
      cursor: not-allowed;
    }

    .dialog-mark {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: var(--dialog-soft);
      color: var(--dialog-tone);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dialog-tone) 18%, transparent);
    }

    .dialog-mark .material-symbols-rounded {
      font-size: 26px;
    }

    .dialog-copy {
      margin-top: 16px;
      padding-right: 24px;
    }

    .dialog-kicker {
      margin: 0 0 6px;
      color: var(--dialog-tone);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      color: var(--ac-text);
      font-size: 20px;
      line-height: 1.25;
      font-weight: 850;
    }

    .dialog-copy p:not(.dialog-kicker) {
      margin: 9px 0 0;
      color: var(--ac-text-3);
      font-size: 14px;
      line-height: 1.55;
    }

    .dialog-copy small {
      display: block;
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--ac-surface-2) 70%, transparent);
      color: var(--ac-muted);
      line-height: 1.45;
    }

    .dialog-form {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }

    .dialog-form label {
      display: grid;
      gap: 7px;
      color: var(--ac-muted);
      font-size: 12px;
      font-weight: 850;
    }

    .dialog-form label span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .dialog-form label em {
      color: var(--ac-error);
      font-style: normal;
    }

    .dialog-form input,
    .dialog-form textarea {
      width: 100%;
      min-height: 40px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 10px 12px;
      font: inherit;
      outline: 0;
      transition: border-color var(--ac-t), box-shadow var(--ac-t);
    }

    .dialog-form textarea {
      resize: vertical;
      line-height: 1.45;
    }

    .dialog-form input:focus,
    .dialog-form textarea:focus {
      border-color: var(--ac-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 22px;
    }

    .dialog-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 112px;
      height: 38px;
      padding: 0 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      transition: transform var(--ac-t), box-shadow var(--ac-t), background var(--ac-t), border-color var(--ac-t);
    }

    .dialog-btn.secondary {
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      color: var(--ac-text-2);
    }

    .dialog-btn.secondary:hover {
      background: var(--ac-surface-2);
      border-color: var(--ac-border-2);
    }

    .dialog-btn.primary {
      border: 1px solid var(--dialog-tone);
      background: var(--dialog-tone);
      color: #fff;
      box-shadow: 0 10px 18px color-mix(in srgb, var(--dialog-tone) 28%, transparent);
    }

    .dialog-btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 24px color-mix(in srgb, var(--dialog-tone) 34%, transparent);
    }

    .dialog-btn:disabled {
      opacity: .58;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    @media (max-width: 560px) {
      .dialog-backdrop {
        align-items: end;
        padding: 12px;
      }

      .dialog-card {
        padding: 20px;
      }

      .dialog-copy {
        padding-right: 0;
      }

      .dialog-actions {
        flex-direction: column-reverse;
      }

      .dialog-btn {
        width: 100%;
      }
    }

    @keyframes dialogFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes dialogIn {
      from { opacity: 0; transform: translateY(10px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  protected readonly dialogSvc = inject(DialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialogSvc.dialog()?.dismissible) {
      this.cancel();
    }
  }

  protected confirm(dialog: ConfirmDialogState): void {
    if (!this.isValid(dialog)) {
      return;
    }

    if (dialog.fields.length === 0) {
      this.dialogSvc.settle(true);
      return;
    }

    this.dialogSvc.settle(dialog.fields.reduce<DialogFormValues>((values, field) => {
      values[field.name] = field.value?.trim() ?? '';
      return values;
    }, {}));
  }

  protected cancel(): void {
    const dialog = this.dialogSvc.dialog();
    this.dialogSvc.settle(dialog?.fields.length ? null : false);
  }

  protected dismiss(dismissible: boolean): void {
    if (dismissible) {
      this.cancel();
    }
  }

  protected intentLabel(intent: DialogIntent): string {
    const labels: Record<DialogIntent, string> = {
      default: 'Confirmation',
      danger: 'Careful action',
      warning: 'Unsaved changes',
      success: 'Ready',
      info: 'Please confirm'
    };

    return labels[intent];
  }

  protected isValid(dialog: ConfirmDialogState): boolean {
    return dialog.fields.every(field => !field.required || Boolean(field.value?.trim()));
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, OnDestroy, OnChanges, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
  selector: 'ac-admin-drawer',
  standalone: true,
  imports: [CommonModule, A11yModule],
  template: `
    @if (open) {
      <div class="ac-admin-drawer-backdrop" aria-hidden="true" (click)="requestClose()"></div>
      <aside class="ac-admin-drawer" role="dialog" aria-modal="true" [attr.aria-label]="title" [attr.aria-busy]="busy" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
        <div class="ac-admin-drawer-head">
          <div class="ac-admin-drawer-title">
            <span class="ac-admin-drawer-icon material-symbols-rounded">{{ icon }}</span>
            <div>
              <p>{{ eyebrow }}</p>
              <h2>{{ title }}</h2>
            </div>
          </div>
          <button class="icon-btn" type="button" cdkFocusInitial (click)="requestClose()" [disabled]="busy" [attr.aria-label]="closeTitle" [attr.title]="closeTitle">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div class="ac-admin-drawer-summary">
          <ng-content select="[drawer-summary]" />
        </div>

        <div class="ac-admin-drawer-body">
          <ng-content select="[drawer-body]" />
        </div>

        <div class="ac-admin-drawer-actions">
          <ng-content select="[drawer-actions]" />
        </div>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcAdminDrawerComponent implements OnChanges, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private previousOverflow: string | null = null;
  @Input() open = false;
  @Input() busy = false;
  @Input() icon = 'edit_square';
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() closeTitle = 'Close editor';
  @Output() readonly closed = new EventEmitter<void>();

  ngOnChanges(): void {
    if (this.open && this.previousOverflow === null) {
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
    } else if (!this.open) this.unlockScroll();
  }
  ngOnDestroy(): void { this.unlockScroll(); }
  private unlockScroll(): void {
    if (this.previousOverflow !== null) this.document.body.style.overflow = this.previousOverflow;
    this.previousOverflow = null;
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.open) {
      this.requestClose();
    }
  }

  protected requestClose(): void {
    if (!this.busy) this.closed.emit();
  }
}

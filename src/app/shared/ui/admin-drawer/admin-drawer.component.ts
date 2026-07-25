import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'ac-admin-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="ac-admin-drawer-backdrop" aria-hidden="true"></div>
      <aside class="ac-admin-drawer" role="dialog" aria-modal="true" [attr.aria-label]="title">
        <div class="ac-admin-drawer-head">
          <div class="ac-admin-drawer-title">
            <span class="ac-admin-drawer-icon material-symbols-rounded">{{ icon }}</span>
            <div>
              <p>{{ eyebrow }}</p>
              <h2>{{ title }}</h2>
            </div>
          </div>
          <button class="icon-btn" type="button" (click)="requestClose()" [attr.title]="closeTitle">
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
export class AcAdminDrawerComponent {
  @Input() open = false;
  @Input() icon = 'edit_square';
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() closeTitle = 'Close editor';
  @Output() readonly closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.open) {
      this.requestClose();
    }
  }

  protected requestClose(): void {
    this.closed.emit();
  }
}

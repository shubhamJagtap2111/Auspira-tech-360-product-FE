import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcDropdownComponent, DropdownOption } from '../dropdown/dropdown.component';

@Component({
  selector: 'ac-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule, AcDropdownComponent],
  template: `
    <footer class="ac-pagination">
      <div class="ac-pagination-summary">
        @if (totalCount > 0) {
          Showing {{ fromItem() }}-{{ toItem() }} of {{ totalCount }} {{ itemLabel }}
        } @else {
          Showing 0 of 0 {{ itemLabel }}
        }
      </div>

      <div class="ac-pagination-actions">
        <label class="page-size">
          <span>Rows</span>
          <ac-dropdown
            class="page-size-dropdown"
            [ngModel]="pageSize"
            [options]="pageSizeDropdownOptions()"
            ariaLabel="Rows per page"
            (ngModelChange)="changePageSize($event)" />
        </label>

        <div class="page-controls" aria-label="Pagination">
          <button class="page-btn" type="button" [disabled]="pageNumber <= 1" (click)="goToPage(pageNumber - 1)" title="Previous page">
            <span class="material-symbols-rounded">chevron_left</span>
          </button>
          <span class="page-num active">{{ pageNumber }}</span>
          <button class="page-btn" type="button" [disabled]="pageNumber >= totalPages()" (click)="goToPage(pageNumber + 1)" title="Next page">
            <span class="material-symbols-rounded">chevron_right</span>
          </button>
        </div>
      </div>
    </footer>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .ac-pagination {
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px;
      border-top: 1px solid var(--ac-border);
      background: color-mix(in srgb, var(--ac-surface) 96%, transparent);
      flex-wrap: wrap;
    }
    .ac-pagination-summary {
      color: var(--ac-muted);
      font-size: 12.5px;
      line-height: 1.4;
    }
    .ac-pagination-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-left: auto;
    }
    .page-size {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ac-muted);
      font-size: 12.5px;
      font-weight: 700;
    }
    .page-size-dropdown { width: 108px; }
    .page-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-btn,
    .page-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--ac-r-sm);
      font-size: 13px;
    }
    .page-btn {
      border: 1px solid var(--ac-border);
      background: var(--ac-surface);
      color: var(--ac-muted);
      cursor: pointer;
      transition: color var(--ac-t), border-color var(--ac-t), background var(--ac-t);
    }
    .page-btn:hover:not(:disabled) {
      color: var(--ac-primary);
      border-color: color-mix(in srgb, var(--ac-primary) 36%, var(--ac-border));
      background: var(--ac-primary-light);
    }
    .page-btn:disabled {
      cursor: not-allowed;
      opacity: .42;
    }
    .page-btn .material-symbols-rounded { font-size: 19px; }
    .page-num.active {
      background: var(--ac-primary);
      color: #fff;
      font-weight: 800;
    }
    @media (max-width: 760px) {
      .ac-pagination {
        position: sticky;
        bottom: 0;
        justify-content: center;
        padding: 12px;
      }
      .ac-pagination-summary {
        width: 100%;
        text-align: center;
      }
      .ac-pagination-actions {
        width: 100%;
        justify-content: center;
        margin-left: 0;
      }
    }
    @media (max-width: 420px) {
      .ac-pagination-actions {
        flex-direction: column;
      }
      .page-size,
      .page-size-dropdown,
      .page-controls {
        width: 100%;
      }
      .page-size {
        justify-content: space-between;
      }
      .page-controls {
        justify-content: center;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcPaginationComponent {
  @Input() pageNumber = 1;
  @Input() pageSize = 10;
  @Input() totalCount = 0;
  @Input() itemLabel = 'items';
  @Input() pageSizeOptions: readonly number[] = [10, 50, 100, 500];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  protected pageSizeDropdownOptions(): DropdownOption<number>[] {
    return this.pageSizeOptions.map(size => ({
      label: String(size),
      value: size
    }));
  }

  protected totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / Math.max(this.pageSize, 1)));
  }

  protected fromItem(): number {
    if (this.totalCount <= 0) {
      return 0;
    }

    return (Math.max(this.pageNumber, 1) - 1) * this.pageSize + 1;
  }

  protected toItem(): number {
    if (this.totalCount <= 0) {
      return 0;
    }

    return Math.min(Math.max(this.pageNumber, 1) * this.pageSize, this.totalCount);
  }

  protected goToPage(pageNumber: number): void {
    const nextPage = Math.min(Math.max(pageNumber, 1), this.totalPages());
    if (nextPage !== this.pageNumber) {
      this.pageChange.emit(nextPage);
    }
  }

  protected changePageSize(pageSize: number | null): void {
    const value = Number(pageSize);
    if (Number.isFinite(value) && value > 0 && value !== this.pageSize) {
      this.pageSizeChange.emit(value);
    }
  }
}

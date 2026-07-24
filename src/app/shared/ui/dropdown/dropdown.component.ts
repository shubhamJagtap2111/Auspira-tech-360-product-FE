import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

@Component({
  selector: 'ac-dropdown',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AcDropdownComponent),
      multi: true
    }
  ],
  template: `
    <div class="ac-dropdown" [class.open]="open()" [class.disabled]="disabled">
      <button
        class="ac-dropdown-trigger"
        type="button"
        [disabled]="disabled"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel || placeholder"
        (click)="toggle()"
        (blur)="markTouched()">
        <span [class.placeholder]="!selectedOption()">{{ selectedOption()?.label || placeholder }}</span>
        @if (clearable && value !== null && value !== undefined && value !== '') {
          <span class="clear material-symbols-rounded" (click)="clear($event)">close</span>
        }
        <span class="chevron material-symbols-rounded">expand_more</span>
      </button>

      @if (open()) {
        <div class="ac-dropdown-panel">
          @for (option of visibleOptions(); track option.value) {
            <button
              class="ac-dropdown-option"
              type="button"
              [disabled]="option.disabled"
              [class.selected]="isSelected(option.value)"
              (click)="choose(option)">
              <span>{{ option.label }}</span>
              @if (isSelected(option.value)) {
                <span class="material-symbols-rounded">check</span>
              }
            </button>
          } @empty {
            <div class="ac-dropdown-empty">{{ emptyText }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .ac-dropdown { position: relative; min-width: 0; }
    .ac-dropdown-trigger {
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      color: var(--ac-text);
      padding: 0 10px 0 12px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 6px;
      text-align: left;
      font: inherit;
      cursor: pointer;
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    .ac-dropdown-trigger:hover { border-color: color-mix(in srgb, var(--ac-primary) 45%, var(--ac-border)); }
    .open .ac-dropdown-trigger {
      border-color: var(--ac-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac-primary) 14%, transparent);
    }
    .ac-dropdown-trigger > span:first-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }
    .placeholder { color: var(--ac-muted); font-weight: 600 !important; }
    .chevron, .clear { color: var(--ac-muted); font-size: 19px; }
    .clear { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 999px; }
    .clear:hover { background: var(--ac-subtle); color: var(--ac-text); }
    .ac-dropdown-panel {
      position: absolute;
      z-index: 80;
      top: calc(100% + 5px);
      left: 0;
      right: 0;
      max-height: 260px;
      overflow: auto;
      padding: 6px;
      border: 1px solid var(--ac-border);
      border-radius: 8px;
      background: var(--ac-surface);
      box-shadow: 0 18px 38px rgba(15,23,42,.16);
      animation: acDropdownIn .12s ease-out;
    }
    .ac-dropdown-option {
      width: 100%;
      min-height: 38px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--ac-text);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }
    .ac-dropdown-option:hover { background: var(--ac-subtle); }
    .ac-dropdown-option.selected { background: color-mix(in srgb, var(--ac-primary) 20%, transparent); color: var(--ac-primary); font-weight: 800; }
    .ac-dropdown-option:disabled { opacity: .45; cursor: not-allowed; }
    .ac-dropdown-empty { padding: 10px; color: var(--ac-muted); font-size: 13px; }
    .disabled { opacity: .65; }
    @keyframes acDropdownIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcDropdownComponent<T = string> implements ControlValueAccessor {
  @Input() options: DropdownOption<T>[] = [];
  @Input() placeholder = 'Select';
  @Input() emptyText = 'No options available';
  @Input() clearable = false;
  @Input() ariaLabel = '';
  @Output() selectionChange = new EventEmitter<T | null>();

  protected readonly open = signal(false);
  protected value: T | null = null;
  protected disabled = false;

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private onChange: (value: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected selectedOption(): DropdownOption<T> | undefined {
    return this.visibleOptions().find(option => option.value === this.value);
  }

  protected visibleOptions(): DropdownOption<T>[] {
    return this.options
      .map(option => ({ ...option, label: resolveOptionLabel(option) }))
      .filter(option => option.label.length > 0);
  }

  protected isSelected(value: T): boolean {
    return value === this.value;
  }

  protected toggle(): void {
    if (!this.disabled) {
      this.open.update(open => !open);
    }
  }

  protected choose(option: DropdownOption<T>): void {
    if (option.disabled) {
      return;
    }

    this.value = option.value;
    this.onChange(option.value);
    this.selectionChange.emit(option.value);
    this.markTouched();
    this.open.set(false);
  }

  protected clear(event: MouseEvent): void {
    event.stopPropagation();
    this.value = null;
    this.onChange(null);
    this.selectionChange.emit(null);
    this.markTouched();
    this.open.set(false);
  }

  protected markTouched(): void {
    this.onTouched();
  }

  writeValue(value: T | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  @HostListener('document:click', ['$event'])
  protected closeFromOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('keydown.escape')
  protected closeWithEscape(): void {
    this.open.set(false);
  }
}

function resolveOptionLabel<T>(option: DropdownOption<T>): string {
  const label = typeof option.label === 'string' ? option.label.trim() : '';
  if (label) {
    return label;
  }

  if (typeof option.value === 'string' || typeof option.value === 'number') {
    return String(option.value).trim();
  }

  return '';
}

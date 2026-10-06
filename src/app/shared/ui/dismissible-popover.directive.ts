import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, EventEmitter, Input, NgZone, Output, inject } from '@angular/core';

export type PopoverDismissReason = 'outside' | 'focus-out' | 'escape';

/** Capture events before dialog/row handlers can stop propagation. */
@Directive({ selector: '[acDismissiblePopover]', standalone: true })
export class AcDismissiblePopoverDirective {
  @Input('acDismissiblePopover') enabled = false;
  @Input() popoverAnchor: HTMLElement | null = null;
  @Output() dismissPopover = new EventEmitter<PopoverDismissReason>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.zone.runOutsideAngular(() => {
      const outside = (event: Event) => {
        if (this.enabled && !this.containsEvent(event)) this.dismiss('outside');
      };
      const focus = (event: Event) => {
        if (this.enabled && !this.containsEvent(event)) this.dismiss('focus-out');
      };
      const escape = (event: KeyboardEvent) => {
        if (!this.enabled || event.key !== 'Escape' || !this.containsEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        this.dismiss('escape');
        // Escape closes this popup before its containing dialog.
        (this.popoverAnchor ?? this.host.querySelector<HTMLElement>('button, input'))?.focus();
      };
      this.document.addEventListener('pointerdown', outside, true);
      this.document.addEventListener('click', outside, true);
      this.document.addEventListener('focusin', focus, true);
      this.document.addEventListener('keydown', escape, true);
      destroyRef.onDestroy(() => {
        this.document.removeEventListener('pointerdown', outside, true);
        this.document.removeEventListener('click', outside, true);
        this.document.removeEventListener('focusin', focus, true);
        this.document.removeEventListener('keydown', escape, true);
      });
    });
  }

  private containsEvent(event: Event): boolean {
    const path = event.composedPath();
    return path.includes(this.host) || Boolean(this.popoverAnchor && path.includes(this.popoverAnchor));
  }

  private dismiss(reason: PopoverDismissReason): void {
    this.zone.run(() => this.dismissPopover.emit(reason));
  }
}

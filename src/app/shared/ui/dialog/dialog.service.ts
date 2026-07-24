import { Injectable, signal } from '@angular/core';

export type DialogIntent = 'default' | 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  intent?: DialogIntent;
  dismissible?: boolean;
}

export interface ConfirmDialogState extends Required<Omit<ConfirmDialogOptions, 'details'>> {
  id: string;
  details?: string;
}

interface DialogRequest {
  state: ConfirmDialogState;
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly dialog = signal<ConfirmDialogState | null>(null);

  private activeRequest: DialogRequest | null = null;
  private readonly queue: DialogRequest[] = [];

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const request: DialogRequest = {
        state: {
          id: crypto.randomUUID(),
          title: options.title,
          message: options.message,
          details: options.details,
          confirmText: options.confirmText ?? 'Confirm',
          cancelText: options.cancelText ?? 'Cancel',
          icon: options.icon ?? this.defaultIcon(options.intent),
          intent: options.intent ?? 'default',
          dismissible: options.dismissible ?? true
        },
        resolve
      };

      if (this.activeRequest) {
        this.queue.push(request);
        return;
      }

      this.show(request);
    });
  }

  confirmDiscard(message = 'You have unsaved form changes. Leaving now will discard them.'): Promise<boolean> {
    return this.confirm({
      title: 'Discard unsaved changes?',
      message,
      confirmText: 'Discard changes',
      cancelText: 'Keep editing',
      intent: 'warning',
      icon: 'edit_note'
    });
  }

  settle(confirmed: boolean): void {
    const request = this.activeRequest;
    if (!request) {
      return;
    }

    request.resolve(confirmed);
    this.activeRequest = null;
    this.dialog.set(null);

    const next = this.queue.shift();
    if (next) {
      queueMicrotask(() => this.show(next));
    }
  }

  private show(request: DialogRequest): void {
    this.activeRequest = request;
    this.dialog.set(request.state);
  }

  private defaultIcon(intent: DialogIntent | undefined): string {
    const icons: Record<DialogIntent, string> = {
      default: 'help',
      danger: 'warning',
      warning: 'report_problem',
      success: 'check_circle',
      info: 'info'
    };

    return icons[intent ?? 'default'];
  }
}

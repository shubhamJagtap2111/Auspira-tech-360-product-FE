import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private show(type: ToastType, title: string, message?: string): void {
    const id = crypto.randomUUID();
    this.toasts.update(t => [...t, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), 4500);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string)   { this.show('error',   title, message); }
  warning(title: string, message?: string) { this.show('warning', title, message); }
  info(title: string, message?: string)    { this.show('info',    title, message); }

  dismiss(id: string): void {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
